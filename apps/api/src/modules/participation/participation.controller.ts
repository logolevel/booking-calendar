import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  PREVIEW_ROLE_HEADER,
  type EventParticipantsResponse,
} from '@tg-calendar/shared-types';
import { TelegramAuthGuard } from '../../auth/telegram-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { VerifiedTelegramUser } from '../../auth/init-data';
import { AccessService } from '../access/access.service';
import { EventsGateway } from '../realtime/events.gateway';
import { ParticipationService } from './participation.service';
import { AddParticipantDto } from './dto/add-participant.dto';

@Controller('api/events/:eventId')
@UseGuards(TelegramAuthGuard)
export class ParticipationController {
  constructor(
    private readonly participation: ParticipationService,
    private readonly access: AccessService,
    private readonly gateway: EventsGateway,
  ) {}

  @Get('participants')
  async list(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('eventId') eventId: string,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<EventParticipantsResponse> {
    const role = await this.resolveRole(user.id, preview);
    return this.participation.getDetails(eventId, user.id, role);
  }

  @Post('participants/me')
  async join(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('eventId') eventId: string,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<EventParticipantsResponse> {
    const role = await this.resolveRole(user.id, preview);
    await this.participation.joinSelf(eventId, user.id);
    this.gateway.emitEventUpdate(eventId);
    return this.participation.getDetails(eventId, user.id, role);
  }

  @Delete('participants/me')
  async leave(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('eventId') eventId: string,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<EventParticipantsResponse> {
    const role = await this.resolveRole(user.id, preview);
    await this.participation.leaveSelf(eventId, user.id);
    this.gateway.emitEventUpdate(eventId);
    return this.participation.getDetails(eventId, user.id, role);
  }

  @Post('participants')
  async add(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('eventId') eventId: string,
    @Body() dto: AddParticipantDto,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<EventParticipantsResponse> {
    const role = await this.resolveRole(user.id, preview);
    await this.participation.addParticipant(eventId, user.id, role, dto.userId);
    this.gateway.emitEventUpdate(eventId);
    return this.participation.getDetails(eventId, user.id, role);
  }

  @Delete('participants/:participantId')
  async remove(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('eventId') eventId: string,
    @Param('participantId') participantId: string,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<EventParticipantsResponse> {
    const role = await this.resolveRole(user.id, preview);
    await this.participation.removeParticipant(
      eventId,
      user.id,
      role,
      participantId,
    );
    this.gateway.emitEventUpdate(eventId);
    return this.participation.getDetails(eventId, user.id, role);
  }

  @Post('waitlist')
  async joinWaitlist(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('eventId') eventId: string,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<EventParticipantsResponse> {
    const role = await this.resolveRole(user.id, preview);
    await this.participation.joinWaitlist(eventId, user.id);
    this.gateway.emitEventUpdate(eventId);
    return this.participation.getDetails(eventId, user.id, role);
  }

  @Delete('waitlist/me')
  async leaveWaitlist(
    @CurrentUser() user: VerifiedTelegramUser,
    @Param('eventId') eventId: string,
    @Headers(PREVIEW_ROLE_HEADER) preview?: string,
  ): Promise<EventParticipantsResponse> {
    const role = await this.resolveRole(user.id, preview);
    await this.participation.leaveWaitlist(eventId, user.id);
    this.gateway.emitEventUpdate(eventId);
    return this.participation.getDetails(eventId, user.id, role);
  }

  private async resolveRole(userId: number, preview?: string): Promise<Role> {
    const real = await this.access.resolveRole(userId);
    if (!real) {
      throw new ForbiddenException('No access to this app');
    }
    return this.access.applyPreview(real, preview) ?? real;
  }
}
