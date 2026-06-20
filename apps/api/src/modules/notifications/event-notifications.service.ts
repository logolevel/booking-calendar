import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { UsersService } from '../users/users.service';
import { GuestsService } from '../guests/guests.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TelegramService } from '../telegram/telegram.service';

export interface UserDisplay {
  text: string;
  gender: string | null;
}

export interface Tracker {
  userId: number;
  messageId: number;
}

// A single change notice to push to an event's audience: the default reply
// text plus optional per-user overrides, extra recipients and departing users.
export interface EventChangeNotice {
  actorId: number;
  // Default reply text (already HTML-safe) for the general audience.
  text: string;
  // Per-user override reply text (HTML-safe), e.g. the added/removed person.
  overrides?: Map<number, string>;
  // Recipients beyond the live audience that must also get a card + reply
  // (e.g. a user who was just removed and is no longer a participant).
  include?: number[];
  // Non-admin users to stop tracking after this notice (left/removed/leftQueue).
  departing?: number[];
}

// UA labels for event cards/notifications (until i18n is wired on the backend).
const EVENT_TYPE_LABELS: Record<string, string> = {
  women: 'Жінки',
  men: 'Чоловіки',
  mixed: 'Мікст',
  individual: 'Індивідуальне',
  tech_women: 'Технічка (жінки)',
  tech_men: 'Технічка (чоловіки)',
  group: 'Група',
};

const COURT_LABELS: Record<number, string> = {
  1: '🟢 Зелений',
  2: '🔴 Червоний',
};

// Centralizes bot notifications for event changes. The model: each recipient
// keeps one "main" message (an always-current event card with the deep link);
// every change edits that card in place and is announced as a threaded reply,
// so the link is never repeated and the card stays the single source of truth.
@Injectable()
export class EventNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly users: UsersService,
    private readonly guests: GuestsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly telegram: TelegramService,
  ) {}

  // Human-readable one-line event label (court time zone), used in replies and
  // the cancelled-card marker.
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

  // Badge + "Прізвище Ім'я" and gender for a registered user (HTML-safe text).
  async userDisplay(userId: number): Promise<UserDisplay> {
    const profiles = await this.users.getProfileMap([userId]);
    const profile = profiles.get(userId);
    const badge = await this.badge(userId, profile?.isAdmin ?? false);
    return {
      text: `${badge} ${TelegramService.escapeHtml(profile?.name ?? 'Учасник')}`,
      gender: profile?.gender ?? null,
    };
  }

  // Pick the verb form by gender; fall back to masculine when unknown.
  static verb(gender: string | null, male: string, female: string): string {
    return gender === 'female' ? female : male;
  }

  // Build the HTML "main card": date, court, and the participant list in a
  // column (the waitlist/queue is intentionally not rendered here).
  async card(eventId: string): Promise<string> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return 'Подію не знайдено';
    }
    const participants = await this.prisma.eventParticipant.findMany({
      where: { eventId },
      orderBy: { joinedAt: 'asc' },
    });

    const userIds = participants
      .filter((p) => p.userId != null)
      .map((p) => Number(p.userId));
    const guestIds = participants
      .filter((p) => p.guestId != null)
      .map((p) => p.guestId as string);
    const [profiles, guestMap] = await Promise.all([
      this.users.getProfileMap(userIds),
      this.guests.getMap(guestIds),
    ]);

    const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type;
    const dateLine = new Intl.DateTimeFormat('uk-UA', {
      timeZone: 'Europe/Kyiv',
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    }).format(event.startsAt);
    const timeLine = `${EventNotificationsService.fmtTime(
      event.startsAt,
    )}–${EventNotificationsService.fmtTime(event.endsAt)}`;
    const court = COURT_LABELS[event.resourceId] ?? String(event.resourceId);

    const esc = TelegramService.escapeHtml;
    const header = event.title
      ? `${esc(typeLabel)} «${esc(event.title)}»`
      : esc(typeLabel);
    const lines: string[] = [
      `<b>${header}</b>`,
      `🗓 ${esc(dateLine)}, ${esc(timeLine)}`,
      `📍 ${esc(court)}`,
    ];
    if (event.organizerName) {
      lines.push(`👤 Організатор: ${esc(event.organizerName)}`);
    }
    lines.push('');
    lines.push(`👥 Учасники (${participants.length}/${event.capacity}):`);
    if (participants.length === 0) {
      lines.push('—');
      return lines.join('\n');
    }

    const labelById = new Map<string, string>();
    for (const p of participants) {
      if (p.userId != null) {
        const id = Number(p.userId);
        const profile = profiles.get(id);
        const badge = await this.badge(id, profile?.isAdmin ?? false);
        labelById.set(p.id, `${badge} ${esc(profile?.name ?? 'Учасник')}`);
      } else if (p.guestId != null) {
        const guest = guestMap.get(p.guestId);
        labelById.set(p.id, `👥 ${esc(guest?.name ?? 'Гість')} (гість)`);
      } else {
        labelById.set(p.id, '—');
      }
    }

    // Render in join order; a pair's two members are shown together (each
    // marked 🔗) with a blank line around the block to set them apart.
    const pushBlank = (): void => {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
    };
    const rendered = new Set<string>();
    let i = 1;
    for (const p of participants) {
      if (rendered.has(p.id)) {
        continue;
      }
      const partner =
        p.pairId != null
          ? participants.find((o) => o.id !== p.id && o.pairId === p.pairId)
          : undefined;
      if (partner) {
        pushBlank();
        lines.push(`${i}. ${labelById.get(p.id) ?? ''} 🔗`);
        i += 1;
        lines.push(`${i}. ${labelById.get(partner.id) ?? ''} 🔗`);
        i += 1;
        lines.push('');
        rendered.add(p.id);
        rendered.add(partner.id);
      } else {
        lines.push(`${i}. ${labelById.get(p.id) ?? ''}`);
        i += 1;
        rendered.add(p.id);
      }
    }
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines.join('\n');
  }

  private static fmtTime(date: Date): string {
    return new Intl.DateTimeFormat('uk-UA', {
      timeZone: 'Europe/Kyiv',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  // Users that should keep a live card for this event: every admin plus the
  // current participants and waitlist (registered users only; guests have no
  // bot chat). The card itself never lists the waitlist.
  async cardRecipients(eventId: string): Promise<number[]> {
    const [participants, waitlist, adminIds] = await Promise.all([
      this.prisma.eventParticipant.findMany({
        where: { eventId, userId: { not: null } },
        select: { userId: true },
      }),
      this.prisma.eventWaitlist.findMany({
        where: { eventId },
        select: { userId: true },
      }),
      this.access.listAdminIds(),
    ]);
    const ids = new Set<number>(adminIds);
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

  async trackers(eventId: string): Promise<Tracker[]> {
    const rows = await this.prisma.eventChatMessage.findMany({
      where: { eventId },
      select: { userId: true, messageId: true },
    });
    return rows.map((r) => ({
      userId: Number(r.userId),
      messageId: r.messageId,
    }));
  }

  // Ensure the recipient has an up-to-date main card, returning its message id
  // (so the caller can reply to it). Creates the card on first contact,
  // otherwise edits in place. Returns null when delivery is not possible (e.g.
  // the user never started the bot). A stale message (deleted by the user) is
  // transparently re-sent.
  private async ensureCard(
    eventId: string,
    userId: number,
    cardText: string,
    link: string | null,
  ): Promise<number | null> {
    const existing = await this.prisma.eventChatMessage.findUnique({
      where: { eventId_userId: { eventId, userId: BigInt(userId) } },
    });
    if (existing) {
      const result = await this.telegram.editEventCard(
        userId,
        existing.messageId,
        cardText,
        link,
      );
      if (result === 'ok' || result === 'unmodified') {
        return existing.messageId;
      }
      const resentId = await this.telegram.sendEventCard(userId, cardText, link);
      if (resentId == null) {
        return null;
      }
      await this.prisma.eventChatMessage.update({
        where: { id: existing.id },
        data: { messageId: resentId },
      });
      return resentId;
    }
    const messageId = await this.telegram.sendEventCard(userId, cardText, link);
    if (messageId == null) {
      return null;
    }
    await this.prisma.eventChatMessage.create({
      data: { eventId, userId: BigInt(userId), messageId },
    });
    return messageId;
  }

  private async dropTracker(eventId: string, userId: number): Promise<void> {
    await this.prisma.eventChatMessage.deleteMany({
      where: { eventId, userId: BigInt(userId) },
    });
  }

  // Send/refresh the main card for the creator and every admin, with no reply:
  // the card itself is the "event created" notification.
  async pushCreated(eventId: string, actorId: number): Promise<void> {
    const cardText = await this.card(eventId);
    const link = await this.telegram.eventDeepLink(eventId);
    const recipients = new Set<number>(await this.cardRecipients(eventId));
    recipients.add(actorId);
    for (const userId of recipients) {
      await this.ensureCard(eventId, userId, cardText, link);
    }
  }

  // Refresh every recipient's card to the latest state and send a threaded
  // reply describing the change. The actor is always notified; departing
  // non-admins are untracked afterwards so they stop receiving updates.
  async pushChange(
    eventId: string,
    notice: EventChangeNotice,
  ): Promise<void> {
    const cardText = await this.card(eventId);
    const link = await this.telegram.eventDeepLink(eventId);

    const recipients = new Set<number>(await this.cardRecipients(eventId));
    recipients.add(notice.actorId);
    for (const id of notice.include ?? []) {
      recipients.add(id);
    }
    for (const id of notice.overrides?.keys() ?? []) {
      recipients.add(id);
    }

    for (const userId of recipients) {
      const messageId = await this.ensureCard(eventId, userId, cardText, link);
      if (messageId == null) {
        continue;
      }
      const text = notice.overrides?.get(userId) ?? notice.text;
      await this.telegram.replyMessage(userId, text, messageId);
    }

    if (notice.departing && notice.departing.length > 0) {
      const admins = new Set(await this.access.listAdminIds());
      for (const userId of notice.departing) {
        if (!admins.has(userId)) {
          await this.dropTracker(eventId, userId);
        }
      }
    }
  }

  // Snapshot taken before an event is deleted so its audience can still be
  // notified once the row (and its cascade-deleted cards) are gone.
  async cancelSnapshot(
    eventId: string,
  ): Promise<{ trackers: Tracker[]; label: string }> {
    const [trackers, label] = await Promise.all([
      this.trackers(eventId),
      this.label(eventId),
    ]);
    return { trackers, label };
  }

  // Mark each captured main card as cancelled (no link) and reply with the
  // cancellation notice. Use the snapshot taken before deletion.
  async pushCancelled(
    snapshot: { trackers: Tracker[]; label: string },
    text: string,
  ): Promise<void> {
    const cancelled = `${TelegramService.escapeHtml(
      snapshot.label,
    )}\n\n❌ <b>Подію скасовано</b>`;
    for (const t of snapshot.trackers) {
      await this.telegram.editEventCard(t.userId, t.messageId, cancelled);
      await this.telegram.replyMessage(t.userId, text, t.messageId);
    }
  }
}
