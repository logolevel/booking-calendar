import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  PREVIEW_ROLE_HEADER,
  type EventDto,
  type PrimeQuotaPreviewResponse,
} from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { EventsGateway } from '../realtime/events.gateway';
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
    private readonly gateway: EventsGateway,
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

  @Get('prime-quota')
  async primeQuota(
    @CurrentUser() user: VerifiedTelegramUser,
    @Query('startsAt') startsAt: string,
    @Query('endsAt') endsAt: string,
    @Query('resourceId') resourceId: string,
  ): Promise<PrimeQuotaPreviewResponse> {
    await this.requireAccess(user.id);
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const resource = Number(resourceId);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      !Number.isInteger(resource)
    ) {
      throw new BadRequestException('Invalid slot');
    }
    return this.events.primeQuotaPreview(user.id, {
      startsAt: start,
      endsAt: end,
      resourceId: resource,
    });
  }

  @Post()
  async create(
    @CurrentUser() user: VerifiedTelegramUser,
    @Body() dto: CreateEventDto,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<EventDto> {
    const realRole = await this.requireAccess(user.id);
    // Admins previewing a non-admin role are subject to that role's limits.
    const role = this.access.applyPreview(realRole, preview) ?? realRole;
    return this.events.create(user.id, role, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('id') id: string,
    @Body() dto: CreateEventDto,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<EventDto> {
    const realRole = await this.requireAccess(user.id);
    const role = this.access.applyPreview(realRole, preview) ?? realRole;
    const updated = await this.events.update(id, user.id, role, dto);
    this.gateway.emitEventUpdate(id);
    return updated;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('id') id: string,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<void> {
    const realRole = await this.requireAccess(user.id);
    const role = this.access.applyPreview(realRole, preview) ?? realRole;
    await this.events.remove(id, user.id, role);
  }

  private async requireAccess(userId: number) {
    const role = await this.access.resolveRole(userId);
    if (!role) {
      throw new ForbiddenException('No access to this app');
    }
    return role;
  }
}
