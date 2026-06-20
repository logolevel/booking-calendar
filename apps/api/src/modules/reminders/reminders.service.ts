import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { EventNotificationsService } from '../notifications/event-notifications.service';

// How far before an event starts the reminder is meant to fire.
const REMINDER_LEAD_MS = 60 * 60 * 1000;

// Sends each opted-in participant a single bot reminder one hour before an event
// they take part in. Runs once a minute; the EventReminder unique row makes
// every send idempotent (safe across restarts and multiple instances).
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly notifications: EventNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDueReminders(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + REMINDER_LEAD_MS);
      // Events whose one-hour mark has passed but that have not started yet
      // (an event created with under an hour left is reminded right away).
      const events = await this.prisma.event.findMany({
        where: { startsAt: { gt: now, lte: windowEnd } },
        select: { id: true },
      });
      for (const event of events) {
        await this.remindEvent(event.id);
      }
    } catch (error) {
      this.logger.error('Reminder dispatch failed', error as Error);
    } finally {
      this.running = false;
    }
  }

  private async remindEvent(eventId: string): Promise<void> {
    const participants = await this.prisma.eventParticipant.findMany({
      where: { eventId, userId: { not: null } },
      select: { userId: true },
    });
    const userIds = [...new Set(participants.map((p) => Number(p.userId)))];
    if (userIds.length === 0) {
      return;
    }

    const [optedIn, already] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          id: { in: userIds.map((id) => BigInt(id)) },
          remindBeforeEvent: true,
        },
        select: { id: true },
      }),
      this.prisma.eventReminder.findMany({
        where: { eventId },
        select: { userId: true },
      }),
    ]);
    const sent = new Set(already.map((r) => Number(r.userId)));
    const due = optedIn
      .map((u) => Number(u.id))
      .filter((id) => !sent.has(id));
    if (due.length === 0) {
      return;
    }

    const [label, link] = await Promise.all([
      this.notifications.label(eventId),
      this.telegram.eventDeepLink(eventId),
    ]);
    const text = `\u23F0 Нагадування: ${label} починається за годину.`;

    for (const userId of due) {
      // Claim the slot before sending so a mid-run crash cannot double-remind.
      try {
        await this.prisma.eventReminder.create({
          data: { eventId, userId: BigInt(userId) },
        });
      } catch {
        // Unique violation: another run already claimed this reminder.
        continue;
      }
      await this.telegram.notifyUser(userId, text, link);
    }
  }
}
