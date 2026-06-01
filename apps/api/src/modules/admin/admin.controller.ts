import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AdminSettingsResponse } from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('api/admin')
@UseGuards(TelegramAuthGuard)
export class AdminController {
  constructor(
    private readonly access: AccessService,
    private readonly settings: SettingsService,
    private readonly telegram: TelegramService,
  ) {}

  @Get('settings')
  async get(
    @CurrentUser() user: VerifiedTelegramUser,
  ): Promise<AdminSettingsResponse> {
    await this.assertAdmin(user.id);
    return this.current();
  }

  @Patch('settings')
  async update(
    @CurrentUser() user: VerifiedTelegramUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<AdminSettingsResponse> {
    await this.assertAdmin(user.id);

    const prev = await this.current();
    await this.settings.setMaxDaysAhead(dto.maxDaysAhead);
    await this.settings.setBookingOpenHour(dto.bookingOpenHour);

    if (dto.notify) {
      await this.notifyChanges(prev, dto);
    }
    return { maxDaysAhead: dto.maxDaysAhead, bookingOpenHour: dto.bookingOpenHour };
  }

  // Broadcast only the values that actually changed.
  private async notifyChanges(
    prev: AdminSettingsResponse,
    next: AdminSettingsResponse,
  ): Promise<void> {
    if (next.maxDaysAhead !== prev.maxDaysAhead) {
      await this.telegram.broadcastToUsers(
        `📅 Період запису змінено: тепер можна бронювати на ${next.maxDaysAhead} дн. наперед.`,
      );
    }
    if (next.bookingOpenHour !== prev.bookingOpenHour) {
      const hh = String(next.bookingOpenHour).padStart(2, '0');
      await this.telegram.broadcastToUsers(
        `⏰ Час відкриття запису змінено: найдальніший день тепер відкривається о ${hh}:00.`,
      );
    }
  }

  private async current(): Promise<AdminSettingsResponse> {
    const [maxDaysAhead, bookingOpenHour] = await Promise.all([
      this.settings.getMaxDaysAhead(),
      this.settings.getBookingOpenHour(),
    ]);
    return { maxDaysAhead, bookingOpenHour };
  }

  private async assertAdmin(userId: number): Promise<void> {
    const role = await this.access.resolveRole(userId);
    if (role !== Role.admin) {
      throw new ForbiddenException('Admin only');
    }
  }
}
