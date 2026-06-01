import { Injectable } from '@nestjs/common';
import {
  BOOKING_OPEN_HOUR,
  DEFAULT_MAX_DAYS_AHEAD,
  PRIME_TIME_DEFAULT_END,
  PRIME_TIME_DEFAULT_START,
  PRIME_TIME_OVERFLOW_HOUR,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_DAYS_AHEAD_KEY = 'maxDaysAhead';
const BOOKING_OPEN_HOUR_KEY = 'bookingOpenHour';
const PRIME_START_KEY = 'primeStart';
const PRIME_END_KEY = 'primeEnd';
const PRIME_OVERFLOW_HOUR_KEY = 'primeOverflowHour';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

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

  async getBookingOpenHour(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: BOOKING_OPEN_HOUR_KEY },
    });
    if (!setting) {
      return BOOKING_OPEN_HOUR;
    }
    const parsed = Number(setting.value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23
      ? parsed
      : BOOKING_OPEN_HOUR;
  }

  async setBookingOpenHour(hour: number): Promise<void> {
    const value = String(hour);
    await this.prisma.setting.upsert({
      where: { key: BOOKING_OPEN_HOUR_KEY },
      create: { key: BOOKING_OPEN_HOUR_KEY, value },
      update: { value },
    });
  }

  async getPrimeStart(): Promise<string> {
    return this.getTime(PRIME_START_KEY, PRIME_TIME_DEFAULT_START);
  }

  async getPrimeEnd(): Promise<string> {
    return this.getTime(PRIME_END_KEY, PRIME_TIME_DEFAULT_END);
  }

  async setPrimeStart(value: string): Promise<void> {
    await this.setTime(PRIME_START_KEY, value);
  }

  async setPrimeEnd(value: string): Promise<void> {
    await this.setTime(PRIME_END_KEY, value);
  }

  async getPrimeOverflowHour(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: PRIME_OVERFLOW_HOUR_KEY },
    });
    if (!setting) {
      return PRIME_TIME_OVERFLOW_HOUR;
    }
    const parsed = Number(setting.value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23
      ? parsed
      : PRIME_TIME_OVERFLOW_HOUR;
  }

  async setPrimeOverflowHour(hour: number): Promise<void> {
    const value = String(hour);
    await this.prisma.setting.upsert({
      where: { key: PRIME_OVERFLOW_HOUR_KEY },
      create: { key: PRIME_OVERFLOW_HOUR_KEY, value },
      update: { value },
    });
  }

  private async getTime(key: string, fallback: string): Promise<string> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    return setting && HH_MM.test(setting.value) ? setting.value : fallback;
  }

  private async setTime(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}
