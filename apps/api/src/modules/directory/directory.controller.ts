import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { UsersDirectoryResponse } from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { DirectoryService } from './directory.service';

@Controller('api/admin/users')
@UseGuards(TelegramAuthGuard)
export class DirectoryController {
  constructor(
    private readonly directory: DirectoryService,
    private readonly access: AccessService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: VerifiedTelegramUser,
  ): Promise<UsersDirectoryResponse> {
    const role = await this.access.resolveRole(user.id);
    if (role !== Role.admin) {
      throw new ForbiddenException('Admin only');
    }
    return this.directory.list();
  }
}
