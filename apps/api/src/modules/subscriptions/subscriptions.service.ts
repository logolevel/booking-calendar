import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import {
  SUBSCRIPTION_MAX_MONTHS,
  SUBSCRIPTION_MIN_MONTHS,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (
      !Number.isInteger(months) ||
      months < SUBSCRIPTION_MIN_MONTHS ||
      months > SUBSCRIPTION_MAX_MONTHS
    ) {
      throw new BadRequestException(
        `months must be between ${SUBSCRIPTION_MIN_MONTHS} and ${SUBSCRIPTION_MAX_MONTHS}`,
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
    const endsAt = new Date(startsAt);
    // setUTCMonth handles rollover and shorter target months automatically.
    endsAt.setUTCMonth(endsAt.getUTCMonth() + months);
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
