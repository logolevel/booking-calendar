import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  SUBSCRIPTION_SEASON_MONTHS,
  type SubscriptionDto,
  type SubscriptionListResponse,
} from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { TelegramService } from '../telegram/telegram.service';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('api/admin/subscriptions')
@UseGuards(TelegramAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly access: AccessService,
    private readonly users: UsersService,
    private readonly telegram: TelegramService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: VerifiedTelegramUser,
  ): Promise<SubscriptionListResponse> {
    await this.assertAdmin(user.id);
    return { subscriptions: await this.buildList() };
  }

  @Post()
  async create(
    @CurrentUser() user: VerifiedTelegramUser,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionListResponse> {
    await this.assertAdmin(user.id);
    await this.subscriptions.create(dto.userId, dto.months, user.id, dto.note);
    const plan =
      dto.months === SUBSCRIPTION_SEASON_MONTHS
        ? 'сезон'
        : `${dto.months} міс`;
    await this.telegram.notifyUser(
      dto.userId,
      `⭐ Вам активовано абонемент на ${plan}. Прайм-тайм доступний у повному вікні бронювання.`,
    );
    return { subscriptions: await this.buildList() };
  }

  @Delete(':id')
  async cancel(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('id') id: string,
  ): Promise<SubscriptionListResponse> {
    await this.assertAdmin(user.id);
    const userId = await this.subscriptions.cancel(id);
    if (userId !== null) {
      await this.telegram.notifyUser(
        userId,
        'ℹ️ Ваш абонемент скасовано адміністратором.',
      );
    }
    return { subscriptions: await this.buildList() };
  }

  private async buildList(): Promise<SubscriptionDto[]> {
    const rows = await this.subscriptions.listAll();
    const ids = new Set<number>();
    for (const r of rows) {
      ids.add(Number(r.userId));
      ids.add(Number(r.createdBy));
    }
    const profiles = await this.users.getProfileMap([...ids]);
    const now = Date.now();
    // A user counts as a current subscriber if any of their rows is active now.
    const activeUserIds = new Set<number>();
    for (const r of rows) {
      if (r.startsAt.getTime() <= now && r.endsAt.getTime() >= now) {
        activeUserIds.add(Number(r.userId));
      }
    }
    return rows.map((r) => {
      const userId = Number(r.userId);
      const createdBy = Number(r.createdBy);
      const profile = profiles.get(userId);
      return {
        id: r.id,
        userId,
        userName: profile?.name ?? 'Користувач',
        gender: profile?.gender ?? null,
        isAdmin: profile?.isAdmin ?? false,
        isRoot: this.access.isRoot(userId),
        isTrainer: profile?.isTrainer ?? false,
        isSubscriber: activeUserIds.has(userId),
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
        months: r.months,
        note: r.note,
        createdBy,
        createdByName: profiles.get(createdBy)?.name ?? 'Адмін',
        createdAt: r.createdAt.toISOString(),
        isActive:
          r.startsAt.getTime() <= now && r.endsAt.getTime() >= now,
      };
    });
  }

  private async assertAdmin(userId: number): Promise<void> {
    const role = await this.access.resolveRole(userId);
    if (role !== Role.admin) {
      throw new ForbiddenException('Admin only');
    }
  }
}
