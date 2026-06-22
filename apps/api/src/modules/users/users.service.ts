import { Injectable } from '@nestjs/common';
import { type Gender, type User } from '@prisma/client';
import type { UserSearchResult } from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const SEARCH_LIMIT = 10;

export interface UserProfile {
  name: string;
  gender: Gender | null;
  isAdmin: boolean;
  isTrainer: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Display as "Прізвище Ім'я" (last name first), per user-profile rule.
  displayName(user: Pick<User, 'firstName' | 'lastName' | 'username'>): string {
    const full = [user.lastName, user.firstName].filter(Boolean).join(' ').trim();
    if (full) {
      return full;
    }
    return user.username ? `@${user.username}` : 'Користувач';
  }

  async search(query: string): Promise<UserSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) {
      return [];
    }
    const users = await this.prisma.user.findMany({
      where: {
        // Only users who finished onboarding keep the directory tidy.
        onboardedAt: { not: null },
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: SEARCH_LIMIT,
    });
    return users.map((u) => ({
      id: Number(u.id),
      name: this.displayName(u),
      username: u.username ?? null,
    }));
  }

  // Resolve display data for the given ids, preserving order. Ids missing from
  // the table (e.g. a root admin who never opened the app) get a placeholder.
  async listByIds(
    ids: number[],
  ): Promise<
    {
      userId: number;
      name: string;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      gender: Gender | null;
    }[]
  > {
    if (ids.length === 0) {
      return [];
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
    });
    const byId = new Map(users.map((u) => [Number(u.id), u]));
    return ids.map((id) => {
      const u = byId.get(id);
      return u
        ? {
            userId: id,
            name: this.displayName(u),
            firstName: u.firstName,
            lastName: u.lastName,
            username: u.username ?? null,
            gender: u.gender,
          }
        : {
            userId: id,
            name: 'Користувач',
            firstName: null,
            lastName: null,
            username: null,
            gender: null,
          };
    });
  }

  async getProfileMap(ids: number[]): Promise<Map<number, UserProfile>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return new Map();
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique.map((id) => BigInt(id)) } },
    });
    const map = new Map<number, UserProfile>();
    for (const u of users) {
      map.set(Number(u.id), {
        // The isAdmin flag is the source of truth (root is shown separately via
        // isRoot). The role column only catches up when the user re-opens the
        // app, so relying on it made freshly-granted admins show as regular
        // users (and freshly-revoked ones keep the crown).
        name: this.displayName(u),
        gender: u.gender,
        isAdmin: u.isAdmin,
        isTrainer: u.isTrainer,
      });
    }
    return map;
  }
}
