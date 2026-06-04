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
  AdminSettingsResponse,
} from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { UsersService } from '../users/users.service';
import { GrantAdminDto } from './dto/grant-admin.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('api/admin')
@UseGuards(TelegramAuthGuard)
export class AdminController {
  constructor(
    private readonly access: AccessService,
    private readonly settings: SettingsService,
    private readonly telegram: TelegramService,
    private readonly users: UsersService,
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

    const prev = await this.current();
    await this.settings.setMaxDaysAhead(dto.maxDaysAhead);
    await this.settings.setBookingOpenHour(dto.bookingOpenHour);
    await this.settings.setPrimeStart(dto.primeStart);
    await this.settings.setPrimeEnd(dto.primeEnd);
    await this.settings.setPrimeOverflowHour(dto.primeOverflowHour);

    const next: AdminSettingsResponse = {
      maxDaysAhead: dto.maxDaysAhead,
      bookingOpenHour: dto.bookingOpenHour,
      primeStart: dto.primeStart,
      primeEnd: dto.primeEnd,
      primeOverflowHour: dto.primeOverflowHour,
    };
    if (dto.notify) {
      await this.notifyChanges(prev, next);
    }
    return next;
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
    if (next.primeOverflowHour !== prev.primeOverflowHour) {
      const hh = String(next.primeOverflowHour).padStart(2, '0');
      await this.telegram.broadcastToUsers(
        `⏳ Додатковий запис у прайм-тайм за день до події тепер відкривається о ${hh}:00.`,
      );
    }
  }

  private async current(): Promise<AdminSettingsResponse> {
    const [maxDaysAhead, bookingOpenHour, primeStart, primeEnd, primeOverflowHour] =
      await Promise.all([
        this.settings.getMaxDaysAhead(),
        this.settings.getBookingOpenHour(),
        this.settings.getPrimeStart(),
        this.settings.getPrimeEnd(),
        this.settings.getPrimeOverflowHour(),
      ]);
    return {
      maxDaysAhead,
      bookingOpenHour,
      primeStart,
      primeEnd,
      primeOverflowHour,
    };
  }

  private async assertAdmin(userId: number): Promise<void> {
    const role = await this.access.resolveRole(userId);
    if (role !== Role.admin) {
      throw new ForbiddenException('Admin only');
    }
  }
}
