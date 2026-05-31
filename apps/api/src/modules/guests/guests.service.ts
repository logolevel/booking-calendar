import { Injectable } from '@nestjs/common';
import { Gender, type Guest } from '@prisma/client';
import type { GuestDto } from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const SEARCH_LIMIT = 10;

export interface GuestProfile {
  name: string;
  gender: Gender;
}

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  // Display as "Прізвище Ім'я", matching the user directory.
  displayName(guest: Pick<Guest, 'firstName' | 'lastName'>): string {
    return [guest.lastName, guest.firstName].filter(Boolean).join(' ').trim();
  }

  private toDto(guest: Guest): GuestDto {
    return {
      id: guest.id,
      name: this.displayName(guest),
      gender: guest.gender,
    };
  }

  async search(query: string): Promise<GuestDto[]> {
    const q = query.trim();
    if (q.length < 2) {
      return [];
    }
    const guests = await this.prisma.guest.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: SEARCH_LIMIT,
    });
    return guests.map((g) => this.toDto(g));
  }

  async getMap(ids: string[]): Promise<Map<string, GuestProfile>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return new Map();
    }
    const guests = await this.prisma.guest.findMany({
      where: { id: { in: unique } },
    });
    const map = new Map<string, GuestProfile>();
    for (const g of guests) {
      map.set(g.id, { name: this.displayName(g), gender: g.gender });
    }
    return map;
  }
}
