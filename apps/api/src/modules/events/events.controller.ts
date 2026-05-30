import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { EventDto } from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

const DEFAULT_PAST_DAYS = 1;
const DEFAULT_FUTURE_DAYS = 60;

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

@Controller('api/events')
@UseGuards(TelegramAuthGuard)
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: VerifiedTelegramUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<EventDto[]> {
    await this.requireAccess(user.id);

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_PAST_DAYS);
    const defaultTo = new Date(now);
    defaultTo.setDate(defaultTo.getDate() + DEFAULT_FUTURE_DAYS);

    return this.events.list(
      parseDate(from, defaultFrom),
      parseDate(to, defaultTo),
    );
  }

  @Post()
  async create(
    @CurrentUser() user: VerifiedTelegramUser,
    @Body() dto: CreateEventDto,
  ): Promise<EventDto> {
    const role = await this.requireAccess(user.id);
    return this.events.create(user.id, role, dto);
  }

  private async requireAccess(userId: number) {
    const role = await this.access.resolveRole(userId);
    if (!role) {
      throw new ForbiddenException('No access to this app');
    }
    return role;
  }
}
