import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, Role } from '@prisma/client';
import {
  NOTIFICATION_CATEGORY,
  PARTICIPATION_ACTION,
  type EventParticipantsResponse,
  type ParticipationAction,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { UsersService } from '../users/users.service';
import { GuestsService } from '../guests/guests.service';
import { TelegramService } from '../telegram/telegram.service';
import { PrimeTimeService } from '../prime-time/prime-time.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EventNotificationsService } from '../notifications/event-notifications.service';

type Tx = Prisma.TransactionClient;

interface LockedEvent {
  capacity: number;
  createdBy: bigint;
  allowEmpty: boolean;
  startsAt: Date;
  endsAt: Date;
  resourceId: number;
}

@Injectable()
export class ParticipationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly users: UsersService,
    private readonly guests: GuestsService,
    private readonly prime: PrimeTimeService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: EventNotificationsService,
  ) {}

  // Admins and active subscribers may add unlimited extra participants/guests;
  // a regular member must be in the event and is capped at one extra.
  private async canAddUnlimited(role: Role, actorId: number): Promise<boolean> {
    return role === Role.admin || this.subscriptions.isActive(actorId);
  }

  // Lock the event row for the duration of the transaction to avoid two
  // clients grabbing the last seat at the same time.
  private async lockEvent(tx: Tx, eventId: string): Promise<LockedEvent> {
    const rows = await tx.$queryRaw<LockedEvent[]>`
      SELECT "capacity", "createdBy", "allowEmpty", "startsAt", "endsAt", "resourceId"
      FROM "Event" WHERE "id" = ${eventId} FOR UPDATE
    `;
    const event = rows[0];
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  // A finished event is fully read-only: no joins, leaves, or roster edits.
  private assertActive(endsAt: Date): void {
    if (endsAt.getTime() <= Date.now()) {
      throw new ForbiddenException('Event has already ended');
    }
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
      remindBeforeEvent: false,
      participants: [],
      waitlist: [],
      log: [],
    };
  }

  // Toggle the user's sticky "remind me one hour before" preference. It is
  // global (applies to every event they take part in), so future events default
  // to the last value the user set.
  async setReminderPreference(
    userId: number,
    enabled: boolean,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { remindBeforeEvent: enabled },
    });
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
    tx: Tx | PrismaService,
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
  // Walks the queue in order and promotes the first user that still fits the
  // prime-time quota (others are left waiting).
  private async promoteFromWaitlist(
    tx: Tx,
    eventId: string,
    event: LockedEvent,
  ): Promise<number | null> {
    const count = await tx.eventParticipant.count({ where: { eventId } });
    if (count >= event.capacity) {
      return null;
    }
    const queue = await tx.eventWaitlist.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });
    for (const head of queue) {
      const headId = Number(head.userId);
      // System promotion: judge access by the queued user's own status
      // (member role) — admins/subscribers are recognised inside the check.
      const access = await this.prime.checkAccess(
        tx,
        { userId: headId },
        Role.member,
        event,
      );
      if (!access.ok) {
        continue;
      }
      const eligible = await this.prime.checkQuota(
        tx,
        { userId: headId },
        event,
        eventId,
      );
      if (!eligible.ok) {
        continue;
      }
      await tx.eventParticipant.create({
        data: {
          eventId,
          userId: head.userId,
          addedByUserId: head.userId,
        },
      });
      await tx.eventWaitlist.delete({ where: { id: head.id } });
      await this.logAction(
        tx,
        eventId,
        Number(head.userId),
        PARTICIPATION_ACTION.PROMOTED,
        { userId: Number(head.userId) },
      );
      return Number(head.userId);
    }
    return null;
  }

  async joinSelf(eventId: string, actorId: number, role: Role): Promise<void> {
    let joined = false;
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      this.assertActive(event.endsAt);
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
      await this.prime.assertAccess(tx, { userId: actorId }, role, event);
      await this.prime.assertQuota(tx, { userId: actorId }, event, eventId);
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
      joined = true;
    });

    if (joined) {
      const actor = await this.notifications.userDisplay(actorId);
      const verb = EventNotificationsService.verb(
        actor.gender,
        'записався',
        'записалася',
      );
      await this.notifications.pushChange(eventId, {
        actorId,
        text: `${actor.text} ${verb}`,
        overrides: new Map([[actorId, 'Ви записалися ✅']]),
      });
    }
  }

  async addParticipant(
    eventId: string,
    actorId: number,
    role: Role,
    targetUserId: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      this.assertActive(event.endsAt);

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
        if (!(await this.canAddUnlimited(role, actorId))) {
          const addedByActor = await tx.eventParticipant.count({
            where: {
              eventId,
              addedByUserId: BigInt(actorId),
              userId: { not: BigInt(actorId) },
            },
          });
          if (addedByActor >= 1) {
            throw new ForbiddenException(
              'You can add only one extra participant',
            );
          }
        }
      }

      const count = await tx.eventParticipant.count({ where: { eventId } });
      if (count >= event.capacity) {
        throw new ConflictException('Event is full');
      }

      // The access gate and quota apply to the person being booked.
      await this.prime.assertAccess(tx, { userId: targetUserId }, role, event);
      await this.prime.assertQuota(tx, { userId: targetUserId }, event, eventId);

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

    // Notifications only after a successful commit. The added user becomes a
    // participant, so the card refresh reaches them; admins are always included.
    const actor = await this.notifications.userDisplay(actorId);
    const target = await this.notifications.userDisplay(targetUserId);
    const added = EventNotificationsService.verb(
      actor.gender,
      'додав',
      'додала',
    );
    await this.notifications.pushChange(eventId, {
      actorId,
      text: `${actor.text} ${added} ${target.text}`,
      overrides: new Map([[targetUserId, `Вас ${added} ${actor.text}`]]),
    });
  }

  // Shared add-extra rule: non-admins must already be in the event. Admins and
  // active subscribers may add unlimited extras; a regular member may add only
  // one (a directory user or a guest). Everyone is bound by the capacity.
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
      if (!(await this.canAddUnlimited(role, actorId))) {
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
    let guestName = 'гостя';
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      this.assertActive(event.endsAt);
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
      // Guests carry no subscription: gated like a member without one.
      await this.prime.assertAccess(tx, { guestId }, role, event);
      await this.prime.assertQuota(tx, { guestId }, event, eventId);
      await tx.eventParticipant.create({
        data: { eventId, guestId, addedByUserId: BigInt(actorId) },
      });
      guestName = this.guests.displayName(guest);
      await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.ADD, {
        guestName,
      });
    });

    await this.broadcastGuestAdded(eventId, actorId, guestName);
  }

  async createAndAddGuest(
    eventId: string,
    actorId: number,
    role: Role,
    input: { firstName: string; lastName: string; gender: Prisma.GuestCreateInput['gender'] },
  ): Promise<void> {
    let guestName = 'гостя';
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      this.assertActive(event.endsAt);
      await this.assertCanAddExtra(tx, eventId, actorId, role, event.capacity);
      const guest = await tx.guest.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          gender: input.gender,
          createdBy: BigInt(actorId),
        },
      });
      // Guests carry no subscription: gated like a member without one. A fresh
      // guest has no prior bookings, so only the time gate can block here.
      await this.prime.assertAccess(tx, { guestId: guest.id }, role, event);
      await this.prime.assertQuota(tx, { guestId: guest.id }, event, eventId);
      await tx.eventParticipant.create({
        data: { eventId, guestId: guest.id, addedByUserId: BigInt(actorId) },
      });
      guestName = this.guests.displayName(guest);
      await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.ADD, {
        guestName,
      });
    });

    await this.broadcastGuestAdded(eventId, actorId, guestName);
  }

  // A guest has no bot chat, so only the rest of the event is notified.
  private async broadcastGuestAdded(
    eventId: string,
    actorId: number,
    guestName: string,
  ): Promise<void> {
    const actor = await this.notifications.userDisplay(actorId);
    const verb = EventNotificationsService.verb(actor.gender, 'додав', 'додала');
    await this.notifications.pushChange(eventId, {
      actorId,
      text: `${actor.text} ${verb} гостя ${TelegramService.escapeHtml(
        guestName,
      )}`,
    });
  }

  async removeParticipant(
    eventId: string,
    actorId: number,
    role: Role,
    participantId: string,
  ): Promise<boolean> {
    // Captured up front in case the removal empties (and deletes) the event,
    // which cascade-removes the cards we still need to mark as cancelled.
    const cancel = await this.notifications.cancelSnapshot(eventId);
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      this.assertActive(event.endsAt);
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
      if (participant.pairId) {
        await this.dissolvePair(tx, eventId, participant.pairId);
      }
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
      const promoted = await this.promoteFromWaitlist(tx, eventId, event);
      if (wasAuthor) {
        await this.reassignAuthor(tx, eventId);
      }
      const deleted = await this.deleteIfEmpty(tx, eventId, event.allowEmpty);
      return {
        promoted,
        deleted,
        isSelf,
        removedUserId:
          participant.userId != null ? Number(participant.userId) : null,
        guestName: guest ? this.guests.displayName(guest) : null,
      };
    });

    if (result.deleted) {
      await this.notifications.pushCancelled(cancel, 'Подію скасовано');
      return result.deleted;
    }
    await this.notifyRemoval(eventId, actorId, result);
    return result.deleted;
  }

  // Refresh the card for everyone and reply about the removal. The removed user
  // (if registered) gets a personal reply and is then untracked; a promoted
  // waitlist user is told they made it in. Self-removal reads as "left".
  private async notifyRemoval(
    eventId: string,
    actorId: number,
    result: {
      promoted: number | null;
      deleted: boolean;
      isSelf: boolean;
      removedUserId: number | null;
      guestName: string | null;
    },
  ): Promise<void> {
    const actor = await this.notifications.userDisplay(actorId);
    const overrides = new Map<number, string>();
    if (result.promoted != null) {
      overrides.set(result.promoted, 'Ви з черги потрапили в учасники ✅');
    }

    if (result.isSelf) {
      const verb = EventNotificationsService.verb(
        actor.gender,
        'вийшов',
        'вийшла',
      );
      overrides.set(actorId, 'Ви вийшли з події');
      await this.notifications.pushChange(eventId, {
        actorId,
        text: `${actor.text} ${verb}`,
        overrides,
        departing: [actorId],
      });
      return;
    }

    const verb = EventNotificationsService.verb(
      actor.gender,
      'видалив',
      'видалила',
    );
    if (result.guestName) {
      await this.notifications.pushChange(eventId, {
        actorId,
        text: `${actor.text} ${verb} гостя ${TelegramService.escapeHtml(
          result.guestName,
        )}`,
        overrides,
      });
      return;
    }

    const removedId = result.removedUserId;
    const removed =
      removedId != null
        ? (await this.notifications.userDisplay(removedId)).text
        : 'учасника';
    if (removedId != null) {
      overrides.set(removedId, `Вас ${verb} ${actor.text}`);
    }
    await this.notifications.pushChange(eventId, {
      actorId,
      text: `${actor.text} ${verb} ${removed}`,
      overrides,
      include: removedId != null ? [removedId] : undefined,
      departing: removedId != null ? [removedId] : undefined,
    });
  }

  async leaveSelf(eventId: string, actorId: number): Promise<boolean> {
    const cancel = await this.notifications.cancelSnapshot(eventId);
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      this.assertActive(event.endsAt);
      const mine = await tx.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
      });
      if (mine) {
        const wasAuthor = mine.userId != null && mine.userId === event.createdBy;
        await tx.eventParticipant.delete({ where: { id: mine.id } });
        if (mine.pairId) {
          await this.dissolvePair(tx, eventId, mine.pairId);
        }
        await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.LEAVE, {
          userId: actorId,
        });
        const promoted = await this.promoteFromWaitlist(tx, eventId, event);
        if (wasAuthor) {
          await this.reassignAuthor(tx, eventId);
        }
        const deleted = await this.deleteIfEmpty(tx, eventId, event.allowEmpty);
        return { promoted, deleted, outcome: 'left' as const };
      }
      const removed = await tx.eventWaitlist.deleteMany({
        where: { eventId, userId: BigInt(actorId) },
      });
      if (removed.count > 0) {
        await this.logAction(
          tx,
          eventId,
          actorId,
          PARTICIPATION_ACTION.LEFT_QUEUE,
          { userId: actorId },
        );
      }
      return {
        promoted: null,
        deleted: false,
        outcome: removed.count > 0 ? ('leftQueue' as const) : ('noop' as const),
      };
    });

    if (result.deleted) {
      await this.notifications.pushCancelled(cancel, 'Подію скасовано');
      return result.deleted;
    }

    if (result.outcome === 'left') {
      const actor = await this.notifications.userDisplay(actorId);
      const verb = EventNotificationsService.verb(
        actor.gender,
        'вийшов',
        'вийшла',
      );
      const overrides = new Map<number, string>([
        [actorId, 'Ви вийшли з події'],
      ]);
      if (result.promoted != null) {
        overrides.set(result.promoted, 'Ви з черги потрапили в учасники ✅');
      }
      await this.notifications.pushChange(eventId, {
        actorId,
        text: `${actor.text} ${verb}`,
        overrides,
        departing: [actorId],
      });
    } else if (result.outcome === 'leftQueue') {
      const actor = await this.notifications.userDisplay(actorId);
      const verb = EventNotificationsService.verb(
        actor.gender,
        'вийшов',
        'вийшла',
      );
      await this.notifications.pushChange(eventId, {
        actorId,
        text: `${actor.text} ${verb} з черги`,
        overrides: new Map([[actorId, 'Ви вийшли з черги']]),
        departing: [actorId],
      });
    }

    return result.deleted;
  }

  async joinWaitlist(
    eventId: string,
    actorId: number,
    role: Role,
  ): Promise<void> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      this.assertActive(event.endsAt);
      const existing = await tx.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
      });
      if (existing) {
        return 'noop' as const;
      }
      // The access gate and the weekly cap both gate joining the queue.
      await this.prime.assertAccess(tx, { userId: actorId }, role, event);
      await this.prime.assertQuota(tx, { userId: actorId }, event, eventId);
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
        return 'joined' as const;
      }
      await tx.eventWaitlist.upsert({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
        create: { eventId, userId: BigInt(actorId) },
        update: {},
      });
      await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.QUEUED, {
        userId: actorId,
      });
      return 'queued' as const;
    });

    if (outcome === 'noop') {
      return;
    }
    const actor = await this.notifications.userDisplay(actorId);
    if (outcome === 'joined') {
      const verb = EventNotificationsService.verb(
        actor.gender,
        'записався',
        'записалася',
      );
      await this.notifications.pushChange(eventId, {
        actorId,
        text: `${actor.text} ${verb}`,
        overrides: new Map([[actorId, 'Ви записалися ✅']]),
      });
    } else {
      const verb = EventNotificationsService.verb(
        actor.gender,
        'став',
        'стала',
      );
      await this.notifications.pushChange(eventId, {
        actorId,
        text: `${actor.text} ${verb} у чергу`,
        overrides: new Map([[actorId, 'Ви стали у чергу']]),
      });
    }
  }

  async leaveWaitlist(eventId: string, actorId: number): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { endsAt: true },
    });
    if (event) {
      this.assertActive(event.endsAt);
    }
    const removed = await this.prisma.eventWaitlist.deleteMany({
      where: { eventId, userId: BigInt(actorId) },
    });

    if (removed.count > 0) {
      await this.logAction(
        this.prisma,
        eventId,
        actorId,
        PARTICIPATION_ACTION.LEFT_QUEUE,
        { userId: actorId },
      );
      const actor = await this.notifications.userDisplay(actorId);
      const verb = EventNotificationsService.verb(
        actor.gender,
        'вийшов',
        'вийшла',
      );
      await this.notifications.pushChange(eventId, {
        actorId,
        text: `${actor.text} ${verb} з черги`,
        overrides: new Map([[actorId, 'Ви вийшли з черги']]),
        departing: [actorId],
      });
    }
  }

  // Clear a pair, leaving both former members unpaired. Visual only.
  private dissolvePair(
    tx: Tx,
    eventId: string,
    pairId: string,
  ): Promise<unknown> {
    return tx.eventParticipant.updateMany({
      where: { eventId, pairId },
      data: { pairId: null },
    });
  }

  // Resolve a guest's display name for logging, or null when there is none.
  private async guestNameOf(
    tx: Tx,
    guestId: string | null,
  ): Promise<string | null> {
    if (!guestId) {
      return null;
    }
    const guest = await tx.guest.findUnique({ where: { id: guestId } });
    return guest ? this.guests.displayName(guest) : null;
  }

  // Display text for a participant: a badged user name, or a plain guest name.
  private async participantDisplay(participant: {
    userId: bigint | null;
    guestId: string | null;
  }): Promise<{ text: string; gender: string | null; userId: number | null }> {
    if (participant.userId != null) {
      const id = Number(participant.userId);
      const display = await this.notifications.userDisplay(id);
      return { text: display.text, gender: display.gender, userId: id };
    }
    if (participant.guestId != null) {
      const guest = await this.prisma.guest.findUnique({
        where: { id: participant.guestId },
      });
      return {
        text: guest ? this.guests.displayName(guest) : 'Гість',
        gender: null,
        userId: null,
      };
    }
    return { text: 'Учасник', gender: null, userId: null };
  }

  // Visually pair the actor (a participant) with another participant. Has no
  // effect on capacity/quota; each side may only be in one pair at a time.
  async pairWith(
    eventId: string,
    actorId: number,
    targetParticipantId: string,
  ): Promise<void> {
    const partner = await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      this.assertActive(event.endsAt);
      const self = await tx.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
      });
      if (!self) {
        throw new ForbiddenException('Join the event to create a pair');
      }
      if (self.pairId) {
        throw new ConflictException('You are already in a pair');
      }
      const target = await tx.eventParticipant.findUnique({
        where: { id: targetParticipantId },
      });
      if (!target || target.eventId !== eventId) {
        throw new NotFoundException('Participant not found');
      }
      if (target.id === self.id) {
        throw new BadRequestException('Cannot pair with yourself');
      }
      if (target.pairId) {
        throw new ConflictException('Participant is already in a pair');
      }
      const pairId = randomUUID();
      await tx.eventParticipant.updateMany({
        where: { id: { in: [self.id, target.id] } },
        data: { pairId },
      });
      await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.PAIRED, {
        userId: target.userId != null ? Number(target.userId) : null,
        guestName: await this.guestNameOf(tx, target.guestId),
      });
      return { userId: target.userId, guestId: target.guestId };
    });

    const actor = await this.notifications.userDisplay(actorId);
    const mate = await this.participantDisplay(partner);
    const overrides = new Map<number, string>([
      [actorId, `Ви у парі з ${mate.text} 🔗`],
    ]);
    if (mate.userId != null) {
      const verb = EventNotificationsService.verb(
        actor.gender,
        'додав',
        'додала',
      );
      overrides.set(mate.userId, `${actor.text} ${verb} вас у пару 🔗`);
    }
    await this.notifications.pushChange(eventId, {
      actorId,
      category: NOTIFICATION_CATEGORY.OTHER,
      text: `${actor.text} та ${mate.text} — команда 🔗`,
      overrides,
    });
  }

  // Remove the actor's pair (either side may dissolve it). Visual only.
  async unpair(eventId: string, actorId: number): Promise<void> {
    const partner = await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      this.assertActive(event.endsAt);
      const self = await tx.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: BigInt(actorId) } },
      });
      if (!self?.pairId) {
        return null;
      }
      const members = await tx.eventParticipant.findMany({
        where: { eventId, pairId: self.pairId },
      });
      const other = members.find((m) => m.id !== self.id) ?? null;
      await this.dissolvePair(tx, eventId, self.pairId);
      await this.logAction(tx, eventId, actorId, PARTICIPATION_ACTION.UNPAIRED, {
        userId: other?.userId != null ? Number(other.userId) : null,
        guestName: await this.guestNameOf(tx, other?.guestId ?? null),
      });
      return other;
    });

    if (!partner) {
      return;
    }
    const actor = await this.notifications.userDisplay(actorId);
    const mate = await this.participantDisplay(partner);
    const overrides = new Map<number, string>([
      [actorId, 'Ви розформували пару 🔗'],
    ]);
    if (mate.userId != null) {
      const verb = EventNotificationsService.verb(
        actor.gender,
        'розформував',
        'розформувала',
      );
      overrides.set(mate.userId, `${actor.text} ${verb} пару з вами 🔗`);
    }
    await this.notifications.pushChange(eventId, {
      actorId,
      category: NOTIFICATION_CATEGORY.OTHER,
      text: `Пару розформовано: ${actor.text} та ${mate.text}`,
      overrides,
    });
  }

  // Promote as many queued users as the (possibly increased) capacity now
  // allows. Returns promoted user ids in promotion order. Used after a capacity
  // change, where several freed seats may pull in multiple queued users.
  async promoteToCapacity(eventId: string): Promise<number[]> {
    const promoted: number[] = [];
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      let next = await this.promoteFromWaitlist(tx, eventId, event);
      while (next != null) {
        promoted.push(next);
        next = await this.promoteFromWaitlist(tx, eventId, event);
      }
    });
    if (promoted.length > 0) {
      const overrides = new Map<number, string>();
      for (const id of promoted) {
        overrides.set(id, 'Ви з черги потрапили в учасники ✅');
      }
      const names = (
        await Promise.all(
          promoted.map((id) => this.notifications.userDisplay(id)),
        )
      )
        .map((d) => d.text)
        .join(', ');
      await this.notifications.pushChange(eventId, {
        actorId: promoted[0],
        text: `${names} — з черги в учасники ✅`,
        overrides,
      });
    }
    return promoted;
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

    const [participants, waitlist, logs, viewer] = await Promise.all([
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
      this.prisma.user.findUnique({
        where: { id: BigInt(actorId) },
        select: { remindBeforeEvent: true },
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
    const participantUserIds = participants
      .filter((p) => p.userId != null)
      .map((p) => Number(p.userId));
    const participantGuestIds = participants
      .filter((p) => p.guestId != null)
      .map((p) => p.guestId as string);
    const [profiles, guestProfiles, primeCounts, actorUnlimited] =
      await Promise.all([
        this.users.getProfileMap(ids),
        this.guests.getMap(guestIds),
        this.prime.countPrimeWeekForSubjects(
          this.prisma,
          { userIds: participantUserIds, guestIds: participantGuestIds },
          event,
        ),
        this.canAddUnlimited(role, actorId),
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
      !isFull &&
      (role === Role.admin ||
        (isParticipant && (actorUnlimited || addedByActor < 1)));

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
      remindBeforeEvent: viewer?.remindBeforeEvent ?? false,
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
              : p.guestId != null
                ? guest?.name ?? 'Гість'
                : p.archivedName ?? 'Учасник',
          gender:
            profile?.gender ?? guest?.gender ?? p.archivedGender ?? null,
          isAdmin: profile?.isAdmin ?? false,
          isRoot: p.userId != null && this.access.isRoot(Number(p.userId)),
          isGuest: p.guestId != null,
          addedByUserId: Number(p.addedByUserId),
          addedByName: nameOf(Number(p.addedByUserId)),
          addedByGender: profiles.get(Number(p.addedByUserId))?.gender ?? null,
          isSelf,
          canRemove: role === Role.admin || p.addedByUserId === actor || isSelf,
          pairId: p.pairId,
          joinedAt: p.joinedAt.toISOString(),
          primeWeekCount:
            p.userId != null
              ? primeCounts.users.get(Number(p.userId)) ?? 0
              : p.guestId != null
                ? primeCounts.guests.get(p.guestId) ?? 0
                : null,
        };
      }),
      waitlist: waitlist.map((w) => {
        const profile = profiles.get(Number(w.userId));
        return {
          userId: Number(w.userId),
          name: nameOf(Number(w.userId)),
          gender: profile?.gender ?? null,
          isAdmin: profile?.isAdmin ?? false,
          isRoot: this.access.isRoot(Number(w.userId)),
          isSelf: w.userId === actor,
          createdAt: w.createdAt.toISOString(),
        };
      }),
      log: logs.map((l) => ({
        id: l.id,
        action: l.action as ParticipationAction,
        actorName: nameOf(Number(l.actorUserId)),
        actorGender: profiles.get(Number(l.actorUserId))?.gender ?? null,
        targetName:
          l.targetUserId != null
            ? nameOf(Number(l.targetUserId))
            : l.targetGuestName,
        at: l.at.toISOString(),
      })),
    };
  }
}
