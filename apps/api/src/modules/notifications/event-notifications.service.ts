import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TelegramService } from '../telegram/telegram.service';

export interface UserDisplay {
  text: string;
  gender: string | null;
}

// Shared bot-notification helpers for event changes: building the event label,
// the badged display name, the recipient audience, and broadcasting messages.
@Injectable()
export class EventNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly telegram: TelegramService,
  ) {}

  // Human-readable event label for push notifications (court time zone).
  async label(eventId: string): Promise<string> {
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

  // Single status badge by priority: root ❄️ > admin 👑 > subscriber ⭐ > member 👤.
  private async badge(userId: number, isAdmin: boolean): Promise<string> {
    if (this.access.isRoot(userId)) {
      return '\u2744\uFE0E';
    }
    if (isAdmin) {
      return '👑';
    }
    if (await this.subscriptions.isActive(userId)) {
      return '⭐';
    }
    return '👤';
  }

  // Badge + "Прізвище Ім'я" and gender for a registered user.
  async userDisplay(userId: number): Promise<UserDisplay> {
    const profiles = await this.users.getProfileMap([userId]);
    const profile = profiles.get(userId);
    const badge = await this.badge(userId, profile?.isAdmin ?? false);
    return {
      text: `${badge} ${profile?.name ?? 'Учасник'}`,
      gender: profile?.gender ?? null,
    };
  }

  // Pick the verb form by gender; fall back to masculine when unknown.
  static verb(gender: string | null, male: string, female: string): string {
    return gender === 'female' ? female : male;
  }

  // Registered users currently in the event (participants + waitlist). Guests
  // are excluded: they have no private chat with the bot.
  async audience(eventId: string): Promise<number[]> {
    const [participants, waitlist] = await Promise.all([
      this.prisma.eventParticipant.findMany({
        where: { eventId, userId: { not: null } },
        select: { userId: true },
      }),
      this.prisma.eventWaitlist.findMany({
        where: { eventId },
        select: { userId: true },
      }),
    ]);
    const ids = new Set<number>();
    for (const p of participants) {
      if (p.userId != null) {
        ids.add(Number(p.userId));
      }
    }
    for (const w of waitlist) {
      ids.add(Number(w.userId));
    }
    return [...ids];
  }

  // Send `text` (with the event deep link) to each of the given user ids.
  async notify(eventId: string, userIds: number[], text: string): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    const link = await this.telegram.eventDeepLink(eventId);
    for (const userId of userIds) {
      await this.telegram.notifyUser(userId, text, link);
    }
  }

  // Broadcast `text` to the current event audience, minus `exclude`.
  async broadcast(
    eventId: string,
    text: string,
    exclude: number[] = [],
  ): Promise<void> {
    const audience = await this.audience(eventId);
    const excluded = new Set(exclude);
    await this.notify(
      eventId,
      audience.filter((id) => !excluded.has(id)),
      text,
    );
  }
}
