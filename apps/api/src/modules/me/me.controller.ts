import {
  Controller,
  ForbiddenException,
  Get,
  UseGuards,
} from '@nestjs/common';
import type { MeResponse } from '@tg-calendar/shared-types';
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
  async me(@CurrentUser() user: VerifiedTelegramUser): Promise<MeResponse> {
    const role = await this.access.resolveRole(user.id);
    if (!role) {
      throw new ForbiddenException('No access to this app');
    }

    await this.access.syncUser(user, role);
    const maxDaysAhead = await this.settings.getMaxDaysAhead();

    return {
      id: user.id,
      role,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      maxDaysAhead,
    };
  }
}
