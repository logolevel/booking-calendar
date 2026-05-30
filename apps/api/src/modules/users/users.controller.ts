import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { UserSearchResult } from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { UsersService } from './users.service';

@Controller('api/users')
@UseGuards(TelegramAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly access: AccessService,
  ) {}

  @Get('search')
  async search(
    @CurrentUser() user: VerifiedTelegramUser,
    @Query('q') q = '',
  ): Promise<UserSearchResult[]> {
    const role = await this.access.resolveRole(user.id);
    if (!role) {
      throw new ForbiddenException('No access to this app');
    }
    return this.users.search(q);
  }
}
