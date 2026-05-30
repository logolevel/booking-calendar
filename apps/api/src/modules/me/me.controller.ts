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
import { MeService } from './me.service';
import { OnboardingDto } from './dto/onboarding.dto';

@Controller('api')
@UseGuards(TelegramAuthGuard)
export class MeController {
  constructor(
    private readonly access: AccessService,
    private readonly settings: SettingsService,
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
    return this.build(user, stored, role, realRole === Role.admin);
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
    return this.build(user, stored, role, realRole === Role.admin);
  }

  private async build(
    user: VerifiedTelegramUser,
    stored: User | null,
    role: Role,
    isAdmin: boolean,
  ): Promise<MeResponse> {
    const maxDaysAhead = await this.settings.getMaxDaysAhead();
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
    };
  }
}
