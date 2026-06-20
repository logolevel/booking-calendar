import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import {
  SUBSCRIPTION_ALLOWED_MONTHS,
  SUBSCRIPTION_SEASON_MONTHS,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // The last instant of the season the given date falls in (end of that calendar
  // year). Seasonal sport: no subscription extends past the current year.
  private static seasonEnd(from: Date): Date {
    return new Date(Date.UTC(from.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
  }

  // Plan end date. "Season" runs straight to the season end; a 1-month plan adds
  // its month but is still capped to the season end.
  private static computeEndsAt(startsAt: Date, months: number): Date {
    const seasonEnd = SubscriptionsService.seasonEnd(startsAt);
    if (months === SUBSCRIPTION_SEASON_MONTHS) {
      return seasonEnd;
    }
    const end = new Date(startsAt);
    // setUTCMonth handles rollover and shorter target months automatically.
    end.setUTCMonth(end.getUTCMonth() + months);
    return end.getTime() > seasonEnd.getTime() ? seasonEnd : end;
  }

  // Active = there is a row covering the current instant.
  async isActive(userId: number): Promise<boolean> {
    const now = new Date();
    const found = await this.prisma.subscription.findFirst({
      where: {
        userId: BigInt(userId),
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      select: { id: true },
    });
    return found !== null;
  }

  async create(
    userId: number,
    months: number,
    createdBy: number,
    note?: string,
  ): Promise<Subscription> {
    if (!SUBSCRIPTION_ALLOWED_MONTHS.includes(months as never)) {
      throw new BadRequestException(
        `months must be one of: ${SUBSCRIPTION_ALLOWED_MONTHS.join(', ')}`,
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const startsAt = new Date();
    const endsAt = SubscriptionsService.computeEndsAt(startsAt, months);
    return this.prisma.subscription.create({
      data: {
        userId: BigInt(userId),
        startsAt,
        endsAt,
        months,
        createdBy: BigInt(createdBy),
        note: note?.trim() || null,
      },
    });
  }

  // Early termination: end the subscription now instead of deleting it, so the
  // purchase history is preserved (the row simply becomes inactive). Returns
  // the affected user id (for notifications) or null when nothing changed.
  async cancel(id: string): Promise<number | null> {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    const now = new Date();
    if (sub.endsAt.getTime() <= now.getTime()) {
      // Already expired; nothing to cancel.
      return null;
    }
    await this.prisma.subscription.update({
      where: { id },
      data: { endsAt: now },
    });
    return Number(sub.userId);
  }

  // Full purchase history across users, newest first.
  listAll(): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
