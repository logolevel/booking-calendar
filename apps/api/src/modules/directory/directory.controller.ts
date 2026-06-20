import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { UsersDirectoryResponse } from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { DirectoryService } from './directory.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

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

  // Admin fixes another user's profile data. The root admin is never editable.
  @Patch(':userId')
  async update(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserProfileDto,
  ): Promise<UsersDirectoryResponse> {
    const role = await this.access.resolveRole(user.id);
    if (role !== Role.admin) {
      throw new ForbiddenException('Admin only');
    }
    const targetId = Number(userId);
    if (!Number.isInteger(targetId)) {
      throw new BadRequestException('Invalid user id');
    }
    if (this.access.isRoot(targetId)) {
      throw new ForbiddenException('Cannot edit the root admin');
    }
    await this.directory.updateUser(targetId, dto);
    return this.directory.list();
  }

  // Admin removes a user from the Mini App database only (not the Telegram
  // group). An admin must be demoted first; the root admin can never be deleted.
  @Delete(':userId')
  async remove(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('userId') userId: string,
  ): Promise<UsersDirectoryResponse> {
    const role = await this.access.resolveRole(user.id);
    if (role !== Role.admin) {
      throw new ForbiddenException('Admin only');
    }
    const targetId = Number(userId);
    if (!Number.isInteger(targetId)) {
      throw new BadRequestException('Invalid user id');
    }
    await this.directory.deleteUser(user.id, targetId);
    return this.directory.list();
  }

  @Delete('guests/:guestId')
  async removeGuest(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('guestId') guestId: string,
  ): Promise<UsersDirectoryResponse> {
    const role = await this.access.resolveRole(user.id);
    if (role !== Role.admin) {
      throw new ForbiddenException('Admin only');
    }
    await this.directory.deleteGuest(user.id, guestId);
    return this.directory.list();
  }
}
