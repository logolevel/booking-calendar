import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role, type User } from '@prisma/client';
import { PREVIEW_ROLE_HEADER, type MeResponse } from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { SettingsService } from '../settings/settings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { MeService } from './me.service';
import { OnboardingDto } from './dto/onboarding.dto';

@Controller('api')
@UseGuards(TelegramAuthGuard)
export class MeController {
  constructor(
    private readonly access: AccessService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly me: MeService,
  ) {}

  @Get('me')
  async profile(
    @CurrentUser() user: VerifiedTelegramUser,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<MeResponse> {
    const realRole = await this.access.resolveRole(user.id);
    if (!realRole) {
      throw new ForbiddenException('No access to this app');
    }

    // Keep the stored role truthful; preview affects only the response.
    await this.access.syncUser(user, realRole);
    const stored = await this.me.getStored(user.id);
    const role = this.access.applyPreview(realRole, preview) ?? realRole;
    const forcedSubscriber = this.access.previewSubscriber(realRole, preview);
    const forcedTrainer = this.access.previewTrainer(realRole, preview);
    const isTrainer = stored?.isTrainer ?? false;
    return this.build(
      user,
      stored,
      role,
      realRole === Role.admin,
      isTrainer,
      forcedSubscriber,
      forcedTrainer,
    );
  }

  @Post('me/onboarding')
  async onboarding(
    @CurrentUser() user: VerifiedTelegramUser,
    @Body() dto: OnboardingDto,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<MeResponse> {
    const realRole = await this.access.resolveRole(user.id);
    if (!realRole) {
      throw new ForbiddenException('No access to this app');
    }
    await this.access.syncUser(user, realRole);
    const stored = await this.me.completeOnboarding(user.id, dto);
    const role = this.access.applyPreview(realRole, preview) ?? realRole;
    const forcedSubscriber = this.access.previewSubscriber(realRole, preview);
    const forcedTrainer = this.access.previewTrainer(realRole, preview);
    const isTrainer = stored?.isTrainer ?? false;
    return this.build(
      user,
      stored,
      role,
      realRole === Role.admin,
      isTrainer,
      forcedSubscriber,
      forcedTrainer,
    );
  }

  private async build(
    user: VerifiedTelegramUser,
    stored: User | null,
    role: Role,
    isAdmin: boolean,
    isTrainer: boolean,
    // When set, overrides the real subscription status (admin role preview).
    forcedSubscriber?: boolean,
    // When set, overrides the real trainer flag (admin role preview).
    forcedTrainer?: boolean,
  ): Promise<MeResponse> {
    const [
      maxDaysAhead,
      bookingOpenHour,
      primeStart,
      primeEnd,
      subPrimeStart,
      subPrimeEnd,
      primeMemberOpenHour,
      isSubscriber,
    ] = await Promise.all([
      this.settings.getMaxDaysAhead(),
      this.settings.getBookingOpenHour(),
      this.settings.getPrimeStart(),
      this.settings.getPrimeEnd(),
      this.settings.getSubPrimeStart(),
      this.settings.getSubPrimeEnd(),
      this.settings.getPrimeMemberOpenHour(),
      this.subscriptions.isActive(user.id),
    ]);
    return {
      id: user.id,
      role,
      isAdmin,
      firstName: stored?.firstName ?? user.firstName,
      lastName: stored?.lastName ?? user.lastName,
      username: stored?.username ?? user.username,
      gender: stored?.gender ?? null,
      profileComplete: Boolean(stored?.onboardedAt && stored.gender),
      maxDaysAhead,
      bookingOpenHour,
      primeStart,
      primeEnd,
      subPrimeStart,
      subPrimeEnd,
      primeMemberOpenHour,
      isSubscriber: forcedSubscriber ?? isSubscriber,
      isTrainer: forcedTrainer ?? isTrainer,
    };
  }
}
