import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { EventDto, ResourceId } from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { CreateEventDto } from './dto/create-event.dto';

interface EventRow {
  id: string;
  type: string;
  resourceId: number;
  title: string | null;
  capacity: number;
  startsAt: Date;
  endsAt: Date;
  createdBy: bigint;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async list(from: Date, to: Date): Promise<EventDto[]> {
    const events = await this.prisma.event.findMany({
      where: { startsAt: { gte: from, lte: to } },
      orderBy: { startsAt: 'asc' },
    });
    return events.map((event) => this.toDto(event));
  }

  async create(
    userId: number,
    role: Role,
    dto: CreateEventDto,
  ): Promise<EventDto> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    if (role !== Role.admin) {
      await this.assertWithinDateLimit(startsAt);
    }

    const event = await this.prisma.event.create({
      data: {
        type: dto.type,
        resourceId: dto.resourceId,
        title: dto.title ?? null,
        capacity: dto.capacity,
        startsAt,
        endsAt,
        createdBy: BigInt(userId),
      },
    });
    return this.toDto(event);
  }

  private async assertWithinDateLimit(startsAt: Date): Promise<void> {
    const maxDaysAhead = await this.settings.getMaxDaysAhead();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + maxDaysAhead);
    maxDate.setHours(23, 59, 59, 999);

    if (startsAt < todayStart || startsAt > maxDate) {
      throw new ForbiddenException(
        `Events are allowed only within the next ${maxDaysAhead} days`,
      );
    }
  }

  private toDto(event: EventRow): EventDto {
    return {
      id: event.id,
      type: event.type as EventDto['type'],
      resourceId: event.resourceId as ResourceId,
      title: event.title,
      capacity: event.capacity,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      createdBy: Number(event.createdBy),
    };
  }
}
