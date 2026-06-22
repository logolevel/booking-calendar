import { Injectable } from '@nestjs/common';
import {
  EVENT_TYPE,
  type StatsDayEntry,
  type StatsResponse,
  type StatsUserRow,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const KYIV_TZ = 'Europe/Kyiv';

// Regular training types that go through the sign-up list.
const REGULAR_TYPES = new Set<string>([
  EVENT_TYPE.WOMEN,
  EVENT_TYPE.MEN,
  EVENT_TYPE.MIXED,
  EVENT_TYPE.TECH_WOMEN,
  EVENT_TYPE.TECH_MEN,
]);

function kyivDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KYIV_TZ }).format(date);
}

// Returns the UTC start-of-day (00:00 Kyiv) for a "YYYY-MM-DD" string.
function kyivDayStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Approximate: find what UTC time corresponds to midnight Kyiv for this date.
  const naive = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // Format back and adjust: use the actual offset from Intl.
  const offsetMs = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: KYIV_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(naive) + 'T00:00:00',
  ).getTime();
  // Simpler: parse ISO string treated as Kyiv midnight.
  return new Date(`${dateStr}T00:00:00+03:00`);
}

function kyivDayEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+03:00`);
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(from: string, to: string): Promise<StatsResponse> {
    const fromDate = kyivDayStart(from);
    const toDate = kyivDayEnd(to);

    // Fetch all events in the period with their participants.
    const events = await this.prisma.event.findMany({
      where: {
        startsAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        type: true,
        startsAt: true,
        groupSize: true,
        adultsCount: true,
        participants: {
          select: {
            userId: true,
            guestId: true,
            archivedName: true,
            archivedGender: true,
            guest: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Collect all user ids to batch-fetch names and subscription status.
    const userIds = new Set<bigint>();
    for (const ev of events) {
      for (const p of ev.participants) {
        if (p.userId != null) userIds.add(p.userId);
      }
    }

    const [users, subscriptions] = await Promise.all([
      userIds.size > 0
        ? this.prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
      userIds.size > 0
        ? this.prisma.subscription.findMany({
            where: {
              userId: { in: [...userIds] },
              startsAt: { lte: toDate },
              endsAt: { gte: fromDate },
            },
            select: { userId: true },
          })
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));
    const subscriberSet = new Set(subscriptions.map((s) => s.userId.toString()));

    // Aggregate per (userId | guestId) keyed as strings.
    type Key = string;
    interface Acc {
      userId: number | null;
      guestId: string | null;
      name: string;
      hasSubscription: boolean;
      regularVisits: number;
      groupVisits: number;
      childrenVisits: number;
      dayMap: Map<string, number>;
    }

    const accMap = new Map<Key, Acc>();

    const getOrCreate = (
      key: Key,
      userId: bigint | null,
      guestId: string | null,
      name: string,
      hasSub: boolean,
    ): Acc => {
      if (!accMap.has(key)) {
        accMap.set(key, {
          userId: userId != null ? Number(userId) : null,
          guestId,
          name,
          hasSubscription: hasSub,
          regularVisits: 0,
          groupVisits: 0,
          childrenVisits: 0,
          dayMap: new Map(),
        });
      }
      const acc = accMap.get(key)!;
      if (hasSub) acc.hasSubscription = true;
      return acc;
    };

    for (const ev of events) {
      const dayStr = kyivDateStr(ev.startsAt);
      const evType = ev.type as string;
      const isRegular = REGULAR_TYPES.has(evType);
      const isGroup = evType === EVENT_TYPE.GROUP;
      const isChildren = evType === EVENT_TYPE.CHILDREN;

      if (isGroup || isChildren) {
        // Group and children events have no participant list — count as a single
        // synthetic row representing the whole event head count.
        const count = isGroup
          ? (ev.groupSize ?? 0)
          : (ev.adultsCount ?? 0);
        if (count <= 0) continue;
        const key = `event:${ev.id}`;
        const acc = getOrCreate(key, null, null, isGroup ? 'Група' : 'Діти', false);
        if (isGroup) {
          acc.groupVisits += count;
        } else {
          acc.childrenVisits += count;
        }
        acc.dayMap.set(dayStr, (acc.dayMap.get(dayStr) ?? 0) + count);
        continue;
      }

      if (!isRegular) continue;

      for (const p of ev.participants) {
        let key: Key;
        let userId: bigint | null = null;
        let guestId: string | null = null;
        let name: string;
        let hasSub = false;

        if (p.userId != null) {
          userId = p.userId;
          key = `user:${p.userId.toString()}`;
          hasSub = subscriberSet.has(p.userId.toString());
          const u = userMap.get(p.userId.toString());
          name = u
            ? [u.lastName, u.firstName].filter(Boolean).join(' ')
            : `User ${p.userId}`;
        } else if (p.guestId != null) {
          guestId = p.guestId;
          key = `guest:${p.guestId}`;
          const g = p.guest;
          name = g ? `${g.lastName} ${g.firstName}` : (p.archivedName ?? 'Гість');
        } else {
          name = p.archivedName ?? 'Архів';
          key = `archived:${name}`;
        }

        const acc = getOrCreate(key, userId, guestId, name, hasSub);
        acc.regularVisits += 1;
        acc.dayMap.set(dayStr, (acc.dayMap.get(dayStr) ?? 0) + 1);
      }
    }

    const rows: StatsUserRow[] = [...accMap.values()].map((acc) => {
      const days: StatsDayEntry[] = [...acc.dayMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, visits]) => ({ date, visits }));
      return {
        userId: acc.userId,
        guestId: acc.guestId,
        name: acc.name,
        totalVisits: acc.regularVisits + acc.groupVisits + acc.childrenVisits,
        regularVisits: acc.regularVisits,
        groupVisits: acc.groupVisits,
        childrenVisits: acc.childrenVisits,
        hasSubscription: acc.hasSubscription,
        days,
      };
    });

    // Sort by total visits desc, then name.
    rows.sort((a, b) => {
      if (b.totalVisits !== a.totalVisits) return b.totalVisits - a.totalVisits;
      return a.name.localeCompare(b.name, 'uk');
    });

    return { from, to, rows };
  }
}
