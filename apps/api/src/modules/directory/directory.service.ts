import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type {
  DirectoryUserDto,
  UpdateUserProfileRequest,
  UsersDirectoryResponse,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { GuestsService } from '../guests/guests.service';
import { UsersService } from '../users/users.service';
import { ParticipationService } from '../participation/participation.service';
import { EventsGateway } from '../realtime/events.gateway';

@Injectable()
export class DirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly users: UsersService,
    private readonly guests: GuestsService,
    private readonly participation: ParticipationService,
    private readonly gateway: EventsGateway,
  ) {}

  // Every user assigned to exactly one category (admin > subscriber > member),
  // so the per-category counts add up to the grand total. Guests come from the
  // separate guest directory.
  async list(): Promise<UsersDirectoryResponse> {
    const now = new Date();
    const [users, guestRows, activeSubs, adminIds, trainerIds] =
      await Promise.all([
        this.prisma.user.findMany({
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        }),
        this.prisma.guest.findMany({
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        }),
        this.prisma.subscription.findMany({
          where: { startsAt: { lte: now }, endsAt: { gte: now } },
          select: { userId: true },
        }),
        this.access.listAdminIds(),
        this.access.listTrainerIds(),
      ]);

    const adminSet = new Set(adminIds);
    const trainerSet = new Set(trainerIds);
    const subscriberSet = new Set(activeSubs.map((s) => Number(s.userId)));

    // Admins (root first) resolved through listByIds so an env-only root that
    // never opened the app still shows up with a placeholder name.
    const adminRows = await this.users.listByIds(adminIds);
    const admins: DirectoryUserDto[] = adminRows.map((r) => ({
      userId: r.userId,
      name: r.name,
      firstName: r.firstName ?? '',
      lastName: r.lastName,
      username: r.username,
      gender: r.gender,
      isRoot: this.access.isRoot(r.userId),
      isAdmin: true,
      isTrainer: false,
      isSubscriber: subscriberSet.has(r.userId),
    }));

    const trainers: DirectoryUserDto[] = [];
    const subscribers: DirectoryUserDto[] = [];
    const members: DirectoryUserDto[] = [];
    for (const u of users) {
      const id = Number(u.id);
      if (adminSet.has(id)) {
        continue;
      }
      const dto: DirectoryUserDto = {
        userId: id,
        name: this.users.displayName(u),
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username ?? null,
        gender: u.gender,
        isRoot: false,
        isAdmin: false,
        isTrainer: u.isTrainer,
        isSubscriber: subscriberSet.has(id),
      };
      if (u.isTrainer) {
        trainers.push(dto);
      } else if (dto.isSubscriber) {
        subscribers.push(dto);
      } else {
        members.push(dto);
      }
    }

    const guests = guestRows.map((g) => ({
      id: g.id,
      name: this.guests.displayName(g),
      gender: g.gender,
    }));

    return {
      total:
        admins.length +
        trainers.length +
        subscribers.length +
        members.length +
        guests.length,
      admins,
      trainers,
      subscribers,
      members,
      guests,
    };
  }

  // Admin-only fix of another user's profile. The caller (controller) enforces
  // the admin role and blocks editing the root admin.
  async updateUser(
    targetId: number,
    dto: UpdateUserProfileRequest,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(targetId) },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id: BigInt(targetId) },
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        gender: dto.gender,
      },
    });
  }

  // Remove a user from the Mini App database (not from the Telegram group).
  // They are pulled out of every still-running event (with the usual waitlist
  // promotion and notifications) and kept as a plain text record in past ones.
  // Admins must be demoted first; the root admin can never be deleted.
  async deleteUser(adminId: number, targetId: number): Promise<void> {
    if (this.access.isRoot(targetId)) {
      throw new ForbiddenException('Cannot delete the root admin');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(targetId) },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const adminIds = await this.access.listAdminIds();
    if (adminIds.includes(targetId)) {
      throw new ForbiddenException(
        'Remove admin rights before deleting this user',
      );
    }

    const target = BigInt(targetId);
    const now = new Date();
    const affected = new Set<string>();

    // Pull the user out of every event that has not ended yet. Reusing the
    // standard removal keeps waitlist promotion, author hand-off and the change
    // notifications consistent with a normal "remove participant" action.
    const futureParts = await this.prisma.eventParticipant.findMany({
      where: { userId: target, event: { endsAt: { gt: now } } },
      select: { id: true, eventId: true },
    });
    for (const p of futureParts) {
      await this.participation.removeParticipant(
        p.eventId,
        adminId,
        Role.admin,
        p.id,
      );
      affected.add(p.eventId);
    }

    const futureQueued = await this.prisma.eventWaitlist.findMany({
      where: { userId: target, event: { endsAt: { gt: now } } },
      select: { eventId: true },
    });
    for (const w of futureQueued) {
      affected.add(w.eventId);
    }

    const displayName = this.users.displayName(user);
    await this.prisma.$transaction(async (tx) => {
      // Whatever participation is left now belongs to past events: keep it as a
      // detached text record so deleting the user does not erase event history.
      await tx.eventParticipant.updateMany({
        where: { userId: target },
        data: {
          userId: null,
          archivedName: displayName,
          archivedGender: user.gender,
        },
      });
      // Event.createdBy is a required FK: hand authorship of any remaining event
      // to the earliest still-registered participant, or to the acting admin.
      const authored = await tx.event.findMany({
        where: { createdBy: target },
        select: { id: true },
      });
      for (const e of authored) {
        const next = await tx.eventParticipant.findFirst({
          where: { eventId: e.id, userId: { not: null } },
          orderBy: { joinedAt: 'asc' },
          select: { userId: true },
        });
        await tx.event.update({
          where: { id: e.id },
          data: { createdBy: next?.userId ?? BigInt(adminId) },
        });
      }
      await tx.eventWaitlist.deleteMany({ where: { userId: target } });
      await tx.eventReminder.deleteMany({ where: { userId: target } });
      await tx.eventChatMessage.deleteMany({ where: { userId: target } });
      await tx.subscription.deleteMany({ where: { userId: target } });
      await tx.externalAccess.deleteMany({ where: { telegramId: target } });
      await tx.user.delete({ where: { id: target } });
    });

    for (const eventId of affected) {
      this.gateway.emitEventUpdate(eventId);
    }
  }

  // Remove a guest from the directory: drop them from every still-running event
  // and keep them as a text record in past ones. Guests have no account, so
  // there is nothing to clean up beyond their participations.
  async deleteGuest(adminId: number, guestId: string): Promise<void> {
    const guest = await this.prisma.guest.findUnique({
      where: { id: guestId },
    });
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }

    const now = new Date();
    const affected = new Set<string>();
    const futureParts = await this.prisma.eventParticipant.findMany({
      where: { guestId, event: { endsAt: { gt: now } } },
      select: { id: true, eventId: true },
    });
    for (const p of futureParts) {
      await this.participation.removeParticipant(
        p.eventId,
        adminId,
        Role.admin,
        p.id,
      );
      affected.add(p.eventId);
    }

    const displayName = this.guests.displayName(guest);
    await this.prisma.$transaction(async (tx) => {
      // Detach past participations first: the Guest FK cascades on delete, which
      // would otherwise wipe these history rows entirely.
      await tx.eventParticipant.updateMany({
        where: { guestId },
        data: {
          guestId: null,
          archivedName: displayName,
          archivedGender: guest.gender,
        },
      });
      await tx.guest.delete({ where: { id: guestId } });
    });

    for (const eventId of affected) {
      this.gateway.emitEventUpdate(eventId);
    }
  }
}
