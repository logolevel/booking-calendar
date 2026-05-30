import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PREVIEW_ROLE_HEADER, type MeResponse } from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { SettingsService } from '../settings/settings.service';

@Controller('api')
@UseGuards(TelegramAuthGuard)
export class MeController {
  constructor(
    private readonly access: AccessService,
    private readonly settings: SettingsService,
  ) {}

  @Get('me')
  async me(
    @CurrentUser() user: VerifiedTelegramUser,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<MeResponse> {
    const realRole = await this.access.resolveRole(user.id);
    if (!realRole) {
      throw new ForbiddenException('No access to this app');
    }

    // Keep the stored role truthful; preview affects only the response.
    await this.access.syncUser(user, realRole);
    const role = this.access.applyPreview(realRole, preview) ?? realRole;
    const maxDaysAhead = await this.settings.getMaxDaysAhead();

    return {
      id: user.id,
      role,
      isAdmin: realRole === Role.admin,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      maxDaysAhead,
    };
  }
}
