import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { UserSearchResult } from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const SEARCH_LIMIT = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  displayName(user: Pick<User, 'firstName' | 'lastName' | 'username'>): string {
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
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
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: SEARCH_LIMIT,
    });
    return users.map((u) => ({
      id: Number(u.id),
      name: this.displayName(u),
      username: u.username ?? null,
    }));
  }

  async getNameMap(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return new Map();
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique.map((id) => BigInt(id)) } },
    });
    const map = new Map<number, string>();
    for (const u of users) {
      map.set(Number(u.id), this.displayName(u));
    }
    return map;
  }
}
