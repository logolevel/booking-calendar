import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { GuestDto } from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { GuestsService } from './guests.service';

@Controller('api/guests')
@UseGuards(TelegramAuthGuard)
export class GuestsController {
  constructor(
    private readonly guests: GuestsService,
    private readonly access: AccessService,
  ) {}

  @Get('search')
  async search(
    @CurrentUser() user: VerifiedTelegramUser,
    @Query('q') q = '',
  ): Promise<GuestDto[]> {
    const role = await this.access.resolveRole(user.id);
    if (!role) {
      throw new ForbiddenException('No access to this app');
    }
    return this.guests.search(q);
  }
}
