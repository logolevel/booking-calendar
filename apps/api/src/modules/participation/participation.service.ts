import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import {
  PARTICIPATION_ACTION,
  type EventParticipantsResponse,
  type ParticipationAction,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { GuestsService } from '../guests/guests.service';
import { TelegramService } from '../telegram/telegram.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ParticipationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly guests: GuestsService,
    private readonly telegram: TelegramService,
  ) {}

  // Human-readable event label for push notifications (court time zone).
  private async eventLabel(eventId: string): Promise<string> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return 'тренування';
    }
    const when = new Intl.DateTimeFormat('uk-UA', {
      timeZone: 'Europe/Kyiv',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(event.startsAt);
    const name = event.title ?? 'тренування';
    const court = event.resourceId === 1 ? 'Зелений' : 'Червоний';
    return `${name} (${when}, майданчик ${court})`;
  }

  // Lock the event row for the duration of the transaction to avoid two
  // clients grabbing the last seat at the same time.
  private async lockEvent(
    tx: Tx,
    eventId: string,
  ): Promise<{ capacity: number; createdBy: bigint; allowEmpty: boolean }> {
    const rows = await tx.$queryRaw<
      { capacity: number; createdBy: bigint; allowEmpty: boolean }[]
    >`
      SELECT "capacity", "createdBy", "allowEmpty" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE
    `;
    const event = rows[0];
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  // Member events disappear once the last participant leaves; admin events
  // (allowEmpty) may stay empty. Returns true when the event was deleted.
  private async deleteIfEmpty(
    tx: Tx,
    eventId: string,
    allowEmpty: boolean,
  ): Promise<boolean> {
    if (allowEmpty) {
      return false;
    }
    const count = await tx.eventParticipant.count({ where: { eventId } });
    if (count > 0) {
      return false;
    }
    await tx.event.delete({ where: { id: eventId } });
    return true;
  }

  buildDeletedResponse(
    eventId: string,
    role: Role,
  ): EventParticipantsResponse {
    return {
      eventId,
      deleted: true,
      capacity: 0,
      count: 0,
      isFull: false,
      isParticipant: false,
      isWaitlisted: false,
      isAdmin: role === Role.admin,
      isAuthor: false,
      canAddPlusOne: false,
      participants: [],
      waitlist: [],
      log: [],
    };
  }

  // When the author leaves, hand authorship to the earliest-joined user
  // participant that remains (run this after any waitlist promotion).
  private async reassignAuthor(tx: Tx, eventId: string): Promise<void> {
    const next = await tx.eventParticipant.findFirst({
      where: { eventId, userId: { not: null } },
      orderBy: { joinedAt: 'asc' },
    });
    if (next?.userId != null) {
      await tx.event.update({
        where: { id: eventId },
        data: { createdBy: next.userId },
      });
    }
  }

  private logAction(
    tx: Tx,
    eventId: string,
    actorId: number,
    action: ParticipationAction,
    target?: { userId?: number | null; guestName?: string | null },
  ): Promise<unknown> {
    return tx.eventParticipationLog.create({
      data: {
        eventId,
        actorUserId: BigInt(actorId),
        action,
        targetUserId:
          target?.userId != null ? BigInt(target.userId) : null,
        targetGuestName: target?.guestName ?? null,
      },
    });
  }

  // Returns the promoted user id (if any) so the caller can notify after commit.
  private async promoteFromWaitlist(
    tx: Tx,
    eventId: string,
    capacity: number,
  ): Promise<number | null> {
    const count = await tx.eventParticipant.count({ where: { eventId } });
    if (count >= capacity) {
      return null;
    }
    const head = await tx.eventWaitlist.findFirst({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });
    if (!head) {
      return null;
    }
    await tx.eventParticipant.create({
      data: {
        eventId,
        userId: head.userId,
        addedByUserId: head.userId,
      },
    });
    await tx.eventWaitlist.delete({ where: { id: head.id } });
    await this.logAction(tx, eventId, Number(head.userId), PARTICIPATION_ACTION.PROMOTED, {
      userId: Number(head.userId),
    });
    return Number(head.userId);
  }

  async joinSelf(eventId: string, actorId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      const existing = await tx.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
      });
      if (existing) {
        return;
      }
      const count = await tx.eventParticipant.count({ where: { eventId } });
      if (count >= event.capacity) {
        throw new ConflictException('Event is full');
      }
      await tx.eventParticipant.create({
        data: {
          eventId,
          userId: BigInt(actorId),
          addedByUserId: BigInt(actorId),
        },
      });
      await tx.eventWaitlist.deleteMany({
        where: { eventId, userId: BigInt(actorId) },
      });
      await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.JOIN, {
        userId: actorId,
      });
    });
  }

  async addParticipant(
    eventId: string,
    actorId: number,
    role: Role,
    targetUserId: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);

      const target = await tx.user.findUnique({
        where: { id: BigInt(targetUserId) },
      });
      if (!target) {
        throw new BadRequestException('User not found');
      }

      const targetExisting = await tx.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: BigInt(targetUserId) } },
      });
      if (targetExisting) {
        throw new ConflictException('User is already a participant');
      }

      if (role !== Role.admin) {
        const actorParticipant = await tx.eventParticipant.findUnique({
          where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
        });
        if (!actorParticipant) {
          throw new ForbiddenException('Join the event before adding a guest');
        }
        const addedByActor = await tx.eventParticipant.count({
          where: {
            eventId,
            addedByUserId: BigInt(actorId),
            userId: { not: BigInt(actorId) },
          },
        });
        if (addedByActor >= 1) {
          throw new ForbiddenException('You can add only one extra participant');
        }
      }

      const count = await tx.eventParticipant.count({ where: { eventId } });
      if (count >= event.capacity) {
        throw new ConflictException('Event is full');
      }

      await tx.eventParticipant.create({
        data: {
          eventId,
          userId: BigInt(targetUserId),
          addedByUserId: BigInt(actorId),
        },
      });
      await tx.eventWaitlist.deleteMany({
        where: { eventId, userId: BigInt(targetUserId) },
      });
      await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.ADD, {
        userId: targetUserId,
      });
    });

    // Notifications only after a successful commit.
    const profiles = await this.users.getProfileMap([actorId, targetUserId]);
    const label = await this.eventLabel(eventId);
    const actorName = profiles.get(actorId)?.name ?? 'Учасник';
    await this.telegram.notifyUser(
      targetUserId,
      `Вас додав(ла) ${actorName} на ${label}`,
    );
    if (role !== Role.admin) {
      const targetName = profiles.get(targetUserId)?.name ?? 'учасника';
      await this.telegram.notifyAdmin(
        `${actorName} додав(ла) ${targetName} на ${label}`,
      );
    }
  }

  // Shared "+1" rule: non-admins must already be in and may add one extra
  // (a directory user or a guest); everyone is bound by the capacity.
  private async assertCanAddExtra(
    tx: Tx,
    eventId: string,
    actorId: number,
    role: Role,
    capacity: number,
  ): Promise<void> {
    if (role !== Role.admin) {
      const actorParticipant = await tx.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
      });
      if (!actorParticipant) {
        throw new ForbiddenException('Join the event before adding a guest');
      }
      const extras = await tx.eventParticipant.count({
        where: {
          eventId,
          addedByUserId: BigInt(actorId),
          OR: [{ userId: null }, { userId: { not: BigInt(actorId) } }],
        },
      });
      if (extras >= 1) {
        throw new ForbiddenException('You can add only one extra participant');
      }
    }
    const count = await tx.eventParticipant.count({ where: { eventId } });
    if (count >= capacity) {
      throw new ConflictException('Event is full');
    }
  }

  async addExistingGuest(
    eventId: string,
    actorId: number,
    role: Role,
    guestId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      const guest = await tx.guest.findUnique({ where: { id: guestId } });
      if (!guest) {
        throw new BadRequestException('Guest not found');
      }
      const existing = await tx.eventParticipant.findUnique({
        where: { eventId_guestId: { eventId, guestId } },
      });
      if (existing) {
        throw new ConflictException('Guest is already a participant');
      }
      await this.assertCanAddExtra(tx, eventId, actorId, role, event.capacity);
      await tx.eventParticipant.create({
        data: { eventId, guestId, addedByUserId: BigInt(actorId) },
      });
      await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.ADD, {
        guestName: this.guests.displayName(guest),
      });
    });
  }

  async createAndAddGuest(
    eventId: string,
    actorId: number,
    role: Role,
    input: { firstName: string; lastName: string; gender: Prisma.GuestCreateInput['gender'] },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      await this.assertCanAddExtra(tx, eventId, actorId, role, event.capacity);
      const guest = await tx.guest.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          gender: input.gender,
          createdBy: BigInt(actorId),
        },
      });
      await tx.eventParticipant.create({
        data: { eventId, guestId: guest.id, addedByUserId: BigInt(actorId) },
      });
      await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.ADD, {
        guestName: this.guests.displayName(guest),
      });
    });
  }

  async removeParticipant(
    eventId: string,
    actorId: number,
    role: Role,
    participantId: string,
  ): Promise<boolean> {
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      const participant = await tx.eventParticipant.findUnique({
        where: { id: participantId },
      });
      if (!participant || participant.eventId !== eventId) {
        throw new NotFoundException('Participant not found');
      }

      const isSelf =
        participant.userId != null &&
        participant.userId === BigInt(actorId);
      const isOwner = participant.addedByUserId === BigInt(actorId);
      if (role !== Role.admin && !isSelf && !isOwner) {
        throw new ForbiddenException('You can remove only who you added');
      }

      const wasAuthor =
        participant.userId != null && participant.userId === event.createdBy;
      const guest = participant.guestId
        ? await tx.guest.findUnique({ where: { id: participant.guestId } })
        : null;

      await tx.eventParticipant.delete({ where: { id: participant.id } });
      await this.logAction(
        tx,
        eventId,
        actorId,
        isSelf ? PARTICIPATION_ACTION.LEAVE : PARTICIPATION_ACTION.REMOVE,
        {
          userId: participant.userId != null ? Number(participant.userId) : null,
          guestName: guest ? this.guests.displayName(guest) : null,
        },
      );
      const promoted = await this.promoteFromWaitlist(
        tx,
        eventId,
        event.capacity,
      );
      if (wasAuthor) {
        await this.reassignAuthor(tx, eventId);
      }
      const deleted = await this.deleteIfEmpty(tx, eventId, event.allowEmpty);
      return { promoted, deleted };
    });

    if (!result.deleted) {
      await this.notifyPromoted(eventId, result.promoted);
    }
    return result.deleted;
  }

  async leaveSelf(eventId: string, actorId: number): Promise<boolean> {
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      const mine = await tx.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
      });
      if (mine) {
        const wasAuthor = mine.userId != null && mine.userId === event.createdBy;
        await tx.eventParticipant.delete({ where: { id: mine.id } });
        await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.LEAVE, {
          userId: actorId,
        });
        const promoted = await this.promoteFromWaitlist(
          tx,
          eventId,
          event.capacity,
        );
        if (wasAuthor) {
          await this.reassignAuthor(tx, eventId);
        }
        const deleted = await this.deleteIfEmpty(tx, eventId, event.allowEmpty);
        return { promoted, deleted };
      }
      await tx.eventWaitlist.deleteMany({
        where: { eventId, userId: BigInt(actorId) },
      });
      return { promoted: null, deleted: false };
    });

    if (!result.deleted) {
      await this.notifyPromoted(eventId, result.promoted);
    }
    return result.deleted;
  }

  private async notifyPromoted(
    eventId: string,
    promotedUserId: number | null,
  ): Promise<void> {
    if (promotedUserId == null) {
      return;
    }
    const label = await this.eventLabel(eventId);
    await this.telegram.notifyUser(
      promotedUserId,
      `Ви з черги потрапили на ${label}`,
    );
  }

  async joinWaitlist(eventId: string, actorId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      const existing = await tx.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
      });
      if (existing) {
        return;
      }
      const count = await tx.eventParticipant.count({ where: { eventId } });
      if (count < event.capacity) {
        // There is space — join directly instead of waiting.
        await tx.eventParticipant.create({
          data: {
            eventId,
            userId: BigInt(actorId),
            addedByUserId: BigInt(actorId),
          },
        });
        await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.JOIN, {
          userId: actorId,
        });
        return;
      }
      await tx.eventWaitlist.upsert({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
        create: { eventId, userId: BigInt(actorId) },
        update: {},
      });
    });
  }

  async leaveWaitlist(eventId: string, actorId: number): Promise<void> {
    await this.prisma.eventWaitlist.deleteMany({
      where: { eventId, userId: BigInt(actorId) },
    });
  }

  async getDetails(
    eventId: string,
    actorId: number,
    role: Role,
  ): Promise<EventParticipantsResponse> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const [participants, waitlist, logs] = await Promise.all([
      this.prisma.eventParticipant.findMany({
        where: { eventId },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.eventWaitlist.findMany({
        where: { eventId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.eventParticipationLog.findMany({
        where: { eventId },
        orderBy: { at: 'desc' },
        take: 50,
      }),
    ]);

    const ids: number[] = [];
    const guestIds: string[] = [];
    for (const p of participants) {
      if (p.userId != null) ids.push(Number(p.userId));
      if (p.guestId != null) guestIds.push(p.guestId);
      ids.push(Number(p.addedByUserId));
    }
    for (const w of waitlist) ids.push(Number(w.userId));
    for (const l of logs) {
      ids.push(Number(l.actorUserId));
      if (l.targetUserId != null) ids.push(Number(l.targetUserId));
    }
    const [profiles, guestProfiles] = await Promise.all([
      this.users.getProfileMap(ids),
      this.guests.getMap(guestIds),
    ]);
    const nameOf = (id: number): string =>
      profiles.get(id)?.name ?? 'Користувач';

    const actor = BigInt(actorId);
    const count = participants.length;
    const isParticipant = participants.some(
      (p) => p.userId != null && p.userId === actor,
    );
    const isWaitlisted = waitlist.some((w) => w.userId === actor);
    const addedByActor = participants.filter(
      (p) => p.addedByUserId === actor && !(p.userId != null && p.userId === actor),
    ).length;
    const isFull = count >= event.capacity;
    const canAddPlusOne =
      !isFull && (role === Role.admin || (isParticipant && addedByActor < 1));

    return {
      eventId,
      capacity: event.capacity,
      count,
      isFull,
      isParticipant,
      isWaitlisted,
      isAdmin: role === Role.admin,
      isAuthor: event.createdBy === actor,
      canAddPlusOne,
      participants: participants.map((p) => {
        const isSelf = p.userId != null && p.userId === actor;
        const profile =
          p.userId != null ? profiles.get(Number(p.userId)) : undefined;
        const guest =
          p.guestId != null ? guestProfiles.get(p.guestId) : undefined;
        return {
          id: p.id,
          userId: p.userId != null ? Number(p.userId) : null,
          guestId: p.guestId,
          name:
            p.userId != null
              ? nameOf(Number(p.userId))
              : guest?.name ?? 'Гість',
          gender: profile?.gender ?? guest?.gender ?? null,
          isAdmin: profile?.isAdmin ?? false,
          isGuest: p.guestId != null,
          addedByUserId: Number(p.addedByUserId),
          addedByName: nameOf(Number(p.addedByUserId)),
          isSelf,
          canRemove: role === Role.admin || p.addedByUserId === actor || isSelf,
          joinedAt: p.joinedAt.toISOString(),
        };
      }),
      waitlist: waitlist.map((w) => {
        const profile = profiles.get(Number(w.userId));
        return {
          userId: Number(w.userId),
          name: nameOf(Number(w.userId)),
          gender: profile?.gender ?? null,
          isAdmin: profile?.isAdmin ?? false,
          isSelf: w.userId === actor,
          createdAt: w.createdAt.toISOString(),
        };
      }),
      log: logs.map((l) => ({
        id: l.id,
        action: l.action as ParticipationAction,
        actorName: nameOf(Number(l.actorUserId)),
        targetName:
          l.targetUserId != null
            ? nameOf(Number(l.targetUserId))
            : l.targetGuestName,
        at: l.at.toISOString(),
      })),
    };
  }
}
