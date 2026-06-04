import { Injectable } from '@nestjs/common';
import type {
  DirectoryUserDto,
  UsersDirectoryResponse,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { GuestsService } from '../guests/guests.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class DirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly users: UsersService,
    private readonly guests: GuestsService,
  ) {}

  // Every user assigned to exactly one category (admin > subscriber > member),
  // so the per-category counts add up to the grand total. Guests come from the
  // separate guest directory.
  async list(): Promise<UsersDirectoryResponse> {
    const now = new Date();
    const [users, guestRows, activeSubs, adminIds] = await Promise.all([
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
    ]);

    const adminSet = new Set(adminIds);
    const subscriberSet = new Set(activeSubs.map((s) => Number(s.userId)));

    // Admins (root first) resolved through listByIds so an env-only root that
    // never opened the app still shows up with a placeholder name.
    const adminRows = await this.users.listByIds(adminIds);
    const admins: DirectoryUserDto[] = adminRows.map((r) => ({
      userId: r.userId,
      name: r.name,
      username: r.username,
      gender: r.gender,
      isRoot: this.access.isRoot(r.userId),
      isAdmin: true,
      isSubscriber: subscriberSet.has(r.userId),
    }));

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
        username: u.username ?? null,
        gender: u.gender,
        isRoot: false,
        isAdmin: false,
        isSubscriber: subscriberSet.has(id),
      };
      (dto.isSubscriber ? subscribers : members).push(dto);
    }

    const guests = guestRows.map((g) => ({
      id: g.id,
      name: this.guests.displayName(g),
      gender: g.gender,
    }));

    return {
      total:
        admins.length + subscribers.length + members.length + guests.length,
      admins,
      subscribers,
      members,
      guests,
    };
  }
}
