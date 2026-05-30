import { Injectable } from '@nestjs/common';
import { DEFAULT_MAX_DAYS_AHEAD } from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_DAYS_AHEAD_KEY = 'maxDaysAhead';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMaxDaysAhead(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: MAX_DAYS_AHEAD_KEY },
    });
    if (!setting) {
      return DEFAULT_MAX_DAYS_AHEAD;
    }
    const parsed = Number(setting.value);
    return Number.isInteger(parsed) && parsed > 0
      ? parsed
      : DEFAULT_MAX_DAYS_AHEAD;
  }

  async setMaxDaysAhead(days: number): Promise<void> {
    const value = String(days);
    await this.prisma.setting.upsert({
      where: { key: MAX_DAYS_AHEAD_KEY },
      create: { key: MAX_DAYS_AHEAD_KEY, value },
      update: { value },
    });
  }
}
