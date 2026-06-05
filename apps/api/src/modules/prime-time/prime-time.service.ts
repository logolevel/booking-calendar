import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import {
  PRIME_TIME_MAX_GREEN_PER_WEEK,
  PRIME_TIME_MAX_PER_WEEK,
} from '@tg-calendar/shared-types';
import { AccessService } from '../access/access.service';
import { SettingsService } from '../settings/settings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

// Accepts either the base client or a transaction client, so callers may run
// the checks inside an existing transaction (preferred) or standalone.
type Db = Prisma.TransactionClient;

// The minimal event shape the prime-time rules need.
export interface PrimeEvent {
  startsAt: Date;
  endsAt: Date;
  resourceId: number;
}

export type PrimeCheck = { ok: true } | { ok: false; reason: string };

// The weekly quota applies per booked subject: either an app user (userId) or
// a reusable guest (guestId). Guests are limited exactly like users.
export type QuotaSubject = { userId: number } | { guestId: string };

// The green court id; prime-time green bookings are capped at one per week.
const GREEN_RESOURCE_ID = 1;

// Single source of truth for prime-time access (time gate) and the weekly
// quota. Shared by event creation, joining, the waitlist and auto-promotion.
@Injectable()
export class PrimeTimeService {
  constructor(
    private readonly settings: SettingsService,
    private readonly access: AccessService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // Calendar day index (epoch days) and minutes-of-day in Kyiv, so prime-time
  // and week math are correct regardless of the server time zone.
  private static kyivParts(date: Date): { dayIndex: number; minutes: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string): number =>
      Number(parts.find((p) => p.type === type)?.value ?? '0');
    const dayIndex = Math.floor(
      Date.UTC(get('year'), get('month') - 1, get('day')) / 86_400_000,
    );
    return { dayIndex, minutes: get('hour') * 60 + get('minute') };
  }

  // Monday-based week key for a given epoch day index (1970-01-01 was Thu).
  private static weekKey(dayIndex: number): number {
    const dowSunday0 = (dayIndex + 4) % 7;
    const offsetToMonday = (dowSunday0 + 6) % 7;
    return dayIndex - offsetToMonday;
  }

  private static toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':');
    return Number(h) * 60 + Number(m);
  }

  // True when an event (start/end minutes-of-day) overlaps the prime window.
  private static overlaps(
    startMin: number,
    endMin: number,
    primeStart: number,
    primeEnd: number,
  ): boolean {
    return startMin < primeEnd && endMin > primeStart;
  }

  private async primeWindow(): Promise<{ start: number; end: number }> {
    const [startStr, endStr] = await Promise.all([
      this.settings.getPrimeStart(),
      this.settings.getPrimeEnd(),
    ]);
    return {
      start: PrimeTimeService.toMinutes(startStr),
      end: PrimeTimeService.toMinutes(endStr),
    };
  }

  private async subPrimeWindow(): Promise<{ start: number; end: number }> {
    const [startStr, endStr] = await Promise.all([
      this.settings.getSubPrimeStart(),
      this.settings.getSubPrimeEnd(),
    ]);
    return {
      start: PrimeTimeService.toMinutes(startStr),
      end: PrimeTimeService.toMinutes(endStr),
    };
  }

  // Whether the event's own window overlaps the prime (weekly-quota) window.
  async eventInPrime(event: PrimeEvent): Promise<boolean> {
    const { start, end } = await this.primeWindow();
    const s = PrimeTimeService.kyivParts(event.startsAt);
    const e = PrimeTimeService.kyivParts(event.endsAt);
    return PrimeTimeService.overlaps(s.minutes, e.minutes, start, end);
  }

  // Whether the event's own window overlaps the subscription-prime (access
  // gate) window.
  async eventInSubPrime(event: PrimeEvent): Promise<boolean> {
    const { start, end } = await this.subPrimeWindow();
    const s = PrimeTimeService.kyivParts(event.startsAt);
    const e = PrimeTimeService.kyivParts(event.endsAt);
    return PrimeTimeService.overlaps(s.minutes, e.minutes, start, end);
  }

  // Time gate: a regular member may take a subscription-prime slot only from
  // primeMemberOpenHour on the day before the event. The acting admin, the
  // booked admin/root and active subscribers bypass it. Guests carry no
  // subscription, so they are gated exactly like a plain member. The weekly
  // quota is separate and applies to everyone.
  async checkAccess(
    db: Db,
    subject: QuotaSubject,
    actorRole: Role,
    event: PrimeEvent,
  ): Promise<PrimeCheck> {
    if (!(await this.eventInSubPrime(event))) {
      return { ok: true };
    }
    if (actorRole === Role.admin) {
      return { ok: true };
    }
    // User subjects may bypass the gate (root, admin, active subscriber);
    // guests never can — they behave like a member without a subscription.
    if ('userId' in subject) {
      const bookedUserId = subject.userId;
      if (this.access.isRoot(bookedUserId)) {
        return { ok: true };
      }
      const bookedUser = await db.user.findUnique({
        where: { id: BigInt(bookedUserId) },
        select: { isAdmin: true },
      });
      if (bookedUser?.isAdmin) {
        return { ok: true };
      }
      if (await this.subscriptions.isActive(bookedUserId)) {
        return { ok: true };
      }
    }

    const openHour = await this.settings.getPrimeMemberOpenHour();
    const target = PrimeTimeService.kyivParts(event.startsAt);
    const now = PrimeTimeService.kyivParts(new Date());
    const dayBefore = target.dayIndex - 1;
    const opened =
      now.dayIndex > dayBefore ||
      (now.dayIndex === dayBefore && now.minutes >= openHour * 60);
    if (opened) {
      return { ok: true };
    }
    const hh = String(openHour).padStart(2, '0');
    return {
      ok: false,
      reason: `Прайм-тайм для учасників відкривається о ${hh}:00 напередодні події. Абонемент дає доступ одразу.`,
    };
  }

  async assertAccess(
    db: Db,
    subject: QuotaSubject,
    actorRole: Role,
    event: PrimeEvent,
  ): Promise<void> {
    const result = await this.checkAccess(db, subject, actorRole, event);
    if (!result.ok) {
      throw new ForbiddenException(result.reason);
    }
  }

  // Weekly prime-time quota for the booked subject (applies to everyone,
  // always): at most PRIME_TIME_MAX_PER_WEEK prime slots per week, of which at
  // most PRIME_TIME_MAX_GREEN_PER_WEEK may be on the green court. Guests are
  // limited exactly like users (counted by guestId). Pass excludeEventId to
  // ignore an event the subject is being re-evaluated against.
  async checkQuota(
    db: Db,
    subject: QuotaSubject,
    event: PrimeEvent,
    excludeEventId?: string,
  ): Promise<PrimeCheck> {
    const { start, end } = await this.primeWindow();
    const target = PrimeTimeService.kyivParts(event.startsAt);
    const targetEnd = PrimeTimeService.kyivParts(event.endsAt);
    // Nothing to enforce unless the new booking itself falls in prime time.
    if (!PrimeTimeService.overlaps(target.minutes, targetEnd.minutes, start, end)) {
      return { ok: true };
    }

    const subjectWhere =
      'userId' in subject
        ? { userId: BigInt(subject.userId) }
        : { guestId: subject.guestId };
    const targetWeek = PrimeTimeService.weekKey(target.dayIndex);
    // Over-fetch a two-week window, then filter to the exact Kyiv week.
    const from = new Date(event.startsAt.getTime() - 8 * 86_400_000);
    const to = new Date(event.startsAt.getTime() + 8 * 86_400_000);
    const rows = await db.eventParticipant.findMany({
      where: {
        ...subjectWhere,
        ...(excludeEventId ? { eventId: { not: excludeEventId } } : {}),
        event: { startsAt: { gte: from, lte: to } },
      },
      include: {
        event: { select: { startsAt: true, endsAt: true, resourceId: true } },
      },
    });

    let primeCount = 0;
    let greenCount = 0;
    for (const row of rows) {
      const s = PrimeTimeService.kyivParts(row.event.startsAt);
      const e = PrimeTimeService.kyivParts(row.event.endsAt);
      if (PrimeTimeService.weekKey(s.dayIndex) !== targetWeek) {
        continue;
      }
      if (!PrimeTimeService.overlaps(s.minutes, e.minutes, start, end)) {
        continue;
      }
      primeCount += 1;
      if (row.event.resourceId === GREEN_RESOURCE_ID) {
        greenCount += 1;
      }
    }

    if (primeCount >= PRIME_TIME_MAX_PER_WEEK) {
      return {
        ok: false,
        reason: `У прайм-тайм можна записатися не більше ${PRIME_TIME_MAX_PER_WEEK} разів на тиждень.`,
      };
    }
    if (
      event.resourceId === GREEN_RESOURCE_ID &&
      greenCount >= PRIME_TIME_MAX_GREEN_PER_WEEK
    ) {
      return {
        ok: false,
        reason:
          'На зелений майданчик у прайм-тайм можна записатися лише раз на тиждень. Оберіть червоний майданчик.',
      };
    }
    return { ok: true };
  }

  // Count current prime-time bookings each subject holds in the same Kyiv week
  // as the given event. Used to surface a "1/2" status next to participants; it
  // mirrors checkQuota's counting (active EventParticipant rows only) but for a
  // batch of users and guests in one query to avoid N+1.
  async countPrimeWeekForSubjects(
    db: Db,
    subjects: { userIds: number[]; guestIds: string[] },
    event: PrimeEvent,
  ): Promise<{ users: Map<number, number>; guests: Map<string, number> }> {
    const users = new Map<number, number>();
    const guests = new Map<string, number>();
    const userIds = [...new Set(subjects.userIds)];
    const guestIds = [...new Set(subjects.guestIds)];
    for (const id of userIds) {
      users.set(id, 0);
    }
    for (const id of guestIds) {
      guests.set(id, 0);
    }
    if (userIds.length === 0 && guestIds.length === 0) {
      return { users, guests };
    }

    const { start, end } = await this.primeWindow();
    const target = PrimeTimeService.kyivParts(event.startsAt);
    const targetWeek = PrimeTimeService.weekKey(target.dayIndex);
    const from = new Date(event.startsAt.getTime() - 8 * 86_400_000);
    const to = new Date(event.startsAt.getTime() + 8 * 86_400_000);
    const or: Prisma.EventParticipantWhereInput[] = [];
    if (userIds.length > 0) {
      or.push({ userId: { in: userIds.map((id) => BigInt(id)) } });
    }
    if (guestIds.length > 0) {
      or.push({ guestId: { in: guestIds } });
    }
    const rows = await db.eventParticipant.findMany({
      where: { OR: or, event: { startsAt: { gte: from, lte: to } } },
      include: {
        event: { select: { startsAt: true, endsAt: true } },
      },
    });

    for (const row of rows) {
      const s = PrimeTimeService.kyivParts(row.event.startsAt);
      const e = PrimeTimeService.kyivParts(row.event.endsAt);
      if (PrimeTimeService.weekKey(s.dayIndex) !== targetWeek) {
        continue;
      }
      if (!PrimeTimeService.overlaps(s.minutes, e.minutes, start, end)) {
        continue;
      }
      if (row.userId != null) {
        const uid = Number(row.userId);
        if (users.has(uid)) {
          users.set(uid, (users.get(uid) ?? 0) + 1);
        }
      } else if (row.guestId != null && guests.has(row.guestId)) {
        guests.set(row.guestId, (guests.get(row.guestId) ?? 0) + 1);
      }
    }
    return { users, guests };
  }

  async assertQuota(
    db: Db,
    subject: QuotaSubject,
    event: PrimeEvent,
    excludeEventId?: string,
  ): Promise<void> {
    const result = await this.checkQuota(db, subject, event, excludeEventId);
    if (!result.ok) {
      throw new ForbiddenException(result.reason);
    }
  }
}
