import { Injectable } from '@nestjs/common';
import {
  NOTIFICATION_CATEGORY,
  type AdminNotificationSettingsResponse,
  type NotificationCategory,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

// Prisma User column backing each category preference.
const CATEGORY_FIELD: Record<
  NotificationCategory,
  'notifyCreateDelete' | 'notifyRoster' | 'notifyOther'
> = {
  [NOTIFICATION_CATEGORY.CREATE_DELETE]: 'notifyCreateDelete',
  [NOTIFICATION_CATEGORY.ROSTER]: 'notifyRoster',
  [NOTIFICATION_CATEGORY.OTHER]: 'notifyOther',
};

// Stores and applies each admin's per-category notification opt-ins. A missing
// User row (should not happen for an admin) defaults to "receive all".
@Injectable()
export class NotificationPrefsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: number): Promise<AdminNotificationSettingsResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: {
        notifyCreateDelete: true,
        notifyRoster: true,
        notifyOther: true,
      },
    });
    return {
      createDelete: user?.notifyCreateDelete ?? true,
      roster: user?.notifyRoster ?? true,
      other: user?.notifyOther ?? true,
    };
  }

  async set(
    userId: number,
    prefs: AdminNotificationSettingsResponse,
  ): Promise<AdminNotificationSettingsResponse> {
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        notifyCreateDelete: prefs.createDelete,
        notifyRoster: prefs.roster,
        notifyOther: prefs.other,
      },
    });
    return prefs;
  }

  // Keep only the user ids whose preference enables the given category. Ids with
  // no User row are kept (default = receive all).
  async filterByCategory(
    userIds: number[],
    category: NotificationCategory,
  ): Promise<number[]> {
    if (userIds.length === 0) {
      return [];
    }
    const field = CATEGORY_FIELD[category];
    const rows = await this.prisma.user.findMany({
      where: { id: { in: userIds.map((id) => BigInt(id)) } },
      select: {
        id: true,
        notifyCreateDelete: true,
        notifyRoster: true,
        notifyOther: true,
      },
    });
    const enabled = new Map<number, boolean>();
    for (const row of rows) {
      enabled.set(Number(row.id), row[field]);
    }
    return userIds.filter((id) => enabled.get(id) ?? true);
  }
}
