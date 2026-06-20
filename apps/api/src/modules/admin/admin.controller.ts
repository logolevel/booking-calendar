import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type {
  AdminListResponse,
  AdminNotificationSettingsResponse,
  AdminSettingsResponse,
} from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { UsersService } from '../users/users.service';
import { NotificationPrefsService } from '../notifications/notification-prefs.service';
import { GrantAdminDto } from './dto/grant-admin.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';

@Controller('api/admin')
@UseGuards(TelegramAuthGuard)
export class AdminController {
  constructor(
    private readonly access: AccessService,
    private readonly settings: SettingsService,
    private readonly telegram: TelegramService,
    private readonly users: UsersService,
    private readonly notificationPrefs: NotificationPrefsService,
  ) {}

  @Get('admins')
  async listAdmins(
    @CurrentUser() user: VerifiedTelegramUser,
  ): Promise<AdminListResponse> {
    await this.assertAdmin(user.id);
    return this.adminList(user.id);
  }

  @Post('admins')
  async grantAdmin(
    @CurrentUser() user: VerifiedTelegramUser,
    @Body() dto: GrantAdminDto,
  ): Promise<AdminListResponse> {
    await this.assertAdmin(user.id);
    await this.access.grantAdmin(dto.userId);
    if (dto.userId !== user.id) {
      await this.telegram.notifyUser(
        dto.userId,
        '👑 Вам надано права адміністратора.',
      );
    }
    return this.adminList(user.id);
  }

  @Delete('admins/:userId')
  async revokeAdmin(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('userId') userId: string,
  ): Promise<AdminListResponse> {
    await this.assertAdmin(user.id);
    const targetId = Number(userId);
    if (!Number.isFinite(targetId)) {
      throw new BadRequestException('Invalid user id');
    }
    if (targetId === user.id) {
      throw new ForbiddenException('You cannot revoke your own admin rights');
    }
    // revokeAdmin already rejects the root admin.
    await this.access.revokeAdmin(targetId);
    await this.telegram.notifyUser(
      targetId,
      'ℹ️ Ваші права адміністратора скасовано.',
    );
    return this.adminList(user.id);
  }

  private async adminList(viewerId: number): Promise<AdminListResponse> {
    const ids = await this.access.listAdminIds();
    const rows = await this.users.listByIds(ids);
    return {
      admins: rows.map((r) => ({
        userId: r.userId,
        name: r.name,
        username: r.username,
        gender: r.gender,
        isRoot: this.access.isRoot(r.userId),
        isSelf: r.userId === viewerId,
      })),
    };
  }

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

    if (this.toMinutes(dto.primeStart) >= this.toMinutes(dto.primeEnd)) {
      throw new BadRequestException('primeStart must be before primeEnd');
    }
    if (this.toMinutes(dto.subPrimeStart) >= this.toMinutes(dto.subPrimeEnd)) {
      throw new BadRequestException('subPrimeStart must be before subPrimeEnd');
    }
    // The quota window must sit inside the gated subscription-prime window.
    if (
      this.toMinutes(dto.primeStart) < this.toMinutes(dto.subPrimeStart) ||
      this.toMinutes(dto.primeEnd) > this.toMinutes(dto.subPrimeEnd)
    ) {
      throw new BadRequestException(
        'prime-time window must be within the subscription-prime window',
      );
    }

    const prev = await this.current();
    await this.settings.setMaxDaysAhead(dto.maxDaysAhead);
    await this.settings.setBookingOpenHour(dto.bookingOpenHour);
    await this.settings.setPrimeStart(dto.primeStart);
    await this.settings.setPrimeEnd(dto.primeEnd);
    await this.settings.setSubPrimeStart(dto.subPrimeStart);
    await this.settings.setSubPrimeEnd(dto.subPrimeEnd);
    await this.settings.setPrimeMemberOpenHour(dto.primeMemberOpenHour);

    const next: AdminSettingsResponse = {
      maxDaysAhead: dto.maxDaysAhead,
      bookingOpenHour: dto.bookingOpenHour,
      primeStart: dto.primeStart,
      primeEnd: dto.primeEnd,
      subPrimeStart: dto.subPrimeStart,
      subPrimeEnd: dto.subPrimeEnd,
      primeMemberOpenHour: dto.primeMemberOpenHour,
    };
    if (dto.notify) {
      await this.notifyChanges(prev, next);
    }
    return next;
  }

  @Get('notifications')
  async getNotifications(
    @CurrentUser() user: VerifiedTelegramUser,
  ): Promise<AdminNotificationSettingsResponse> {
    await this.assertAdmin(user.id);
    return this.notificationPrefs.get(user.id);
  }

  @Patch('notifications')
  async updateNotifications(
    @CurrentUser() user: VerifiedTelegramUser,
    @Body() dto: UpdateNotificationsDto,
  ): Promise<AdminNotificationSettingsResponse> {
    await this.assertAdmin(user.id);
    return this.notificationPrefs.set(user.id, {
      createDelete: dto.createDelete,
      roster: dto.roster,
      other: dto.other,
    });
  }

  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':');
    return Number(h) * 60 + Number(m);
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
        `⏰ Час відкриття запису змінено: новий день для запису тепер відкривається о ${hh}:00.`,
      );
    }
    if (
      next.primeStart !== prev.primeStart ||
      next.primeEnd !== prev.primeEnd
    ) {
      await this.telegram.broadcastToUsers(
        `🔥 Прайм-тайм змінено: тепер ${next.primeStart}–${next.primeEnd}.`,
      );
    }
    if (
      next.subPrimeStart !== prev.subPrimeStart ||
      next.subPrimeEnd !== prev.subPrimeEnd
    ) {
      await this.telegram.broadcastToUsers(
        `⭐ Прайм-абонемент тайм змінено: тепер ${next.subPrimeStart}–${next.subPrimeEnd}.`,
      );
    }
    if (next.primeMemberOpenHour !== prev.primeMemberOpenHour) {
      const hh = String(next.primeMemberOpenHour).padStart(2, '0');
      await this.telegram.broadcastToUsers(
        `⏳ Прайм-тайм для учасників тепер відкривається о ${hh}:00 напередодні події (абонемент — без обмежень).`,
      );
    }
  }

  private async current(): Promise<AdminSettingsResponse> {
    const [
      maxDaysAhead,
      bookingOpenHour,
      primeStart,
      primeEnd,
      subPrimeStart,
      subPrimeEnd,
      primeMemberOpenHour,
    ] = await Promise.all([
      this.settings.getMaxDaysAhead(),
      this.settings.getBookingOpenHour(),
      this.settings.getPrimeStart(),
      this.settings.getPrimeEnd(),
      this.settings.getSubPrimeStart(),
      this.settings.getSubPrimeEnd(),
      this.settings.getPrimeMemberOpenHour(),
    ]);
    return {
      maxDaysAhead,
      bookingOpenHour,
      primeStart,
      primeEnd,
      subPrimeStart,
      subPrimeEnd,
      primeMemberOpenHour,
    };
  }

  private async assertAdmin(userId: number): Promise<void> {
    const role = await this.access.resolveRole(userId);
    if (role !== Role.admin) {
      throw new ForbiddenException('Admin only');
    }
  }
}
