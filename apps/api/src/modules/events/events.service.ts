import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  BOOKING_OPEN_HOUR,
  EVENT_TYPE,
  PARTICIPATION_ACTION,
  type EventDto,
  type ResourceId,
} from '@tg-calendar/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { CreateEventDto } from './dto/create-event.dto';

interface EventRow {
  id: string;
  type: string;
  resourceId: number;
  title: string | null;
  capacity: number;
  organizerName: string | null;
  organizerPhone: string | null;
  groupSize: number | null;
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
    const counts = await this.prisma.eventParticipant.groupBy({
      by: ['eventId'],
      where: { eventId: { in: events.map((e) => e.id) } },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.eventId, c._count._all]));
    return events.map((event) =>
      this.toDto(event, countMap.get(event.id) ?? 0),
    );
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

    const isAdmin = role === Role.admin;
    const isGroup = dto.type === EVENT_TYPE.GROUP;
    if (isGroup && !isAdmin) {
      throw new ForbiddenException('Only an admin can create a group booking');
    }

    if (!isAdmin) {
      await this.assertWithinDateLimit(startsAt);
    }

    await this.assertNoOverlap(dto.resourceId, startsAt, endsAt);

    // Only an admin may create an event they do not join (empty event). Such
    // admin events are allowed to stay empty; member events are not.
    const joinSelf = !isGroup && !(isAdmin && dto.skipSelf);

    const event = await this.prisma.event.create({
      data: {
        type: dto.type,
        resourceId: dto.resourceId,
        title: dto.title ?? null,
        capacity: dto.capacity,
        allowEmpty: isAdmin,
        organizerName: isGroup ? dto.organizerName ?? null : null,
        organizerPhone: isGroup ? dto.organizerPhone ?? null : null,
        groupSize: isGroup ? dto.groupSize ?? null : null,
        startsAt,
        endsAt,
        createdBy: BigInt(userId),
      },
    });

    if (joinSelf) {
      await this.prisma.eventParticipant.create({
        data: {
          eventId: event.id,
          userId: BigInt(userId),
          addedByUserId: BigInt(userId),
        },
      });
      await this.prisma.eventParticipationLog.create({
        data: {
          eventId: event.id,
          actorUserId: BigInt(userId),
          targetUserId: BigInt(userId),
          action: PARTICIPATION_ACTION.JOIN,
        },
      });
    }

    return this.toDto(event, joinSelf ? 1 : 0);
  }

  async update(
    id: string,
    userId: number,
    role: Role,
    dto: CreateEventDto,
  ): Promise<EventDto> {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    this.assertNotEnded(existing.endsAt);

    const isAdmin = role === Role.admin;
    const isAuthor = existing.createdBy === BigInt(userId);
    if (!isAdmin && !isAuthor) {
      throw new ForbiddenException('Only the author or an admin can edit');
    }

    // The author (non-admin) may change the capacity only; everything else
    // stays as it was. They may not drop it below the people already in.
    // Admins may edit every field.
    if (!isAdmin) {
      const count = await this.countParticipants(id);
      if (dto.capacity < count) {
        throw new BadRequestException(
          'Capacity cannot be below the current participant count',
        );
      }
      const event = await this.prisma.event.update({
        where: { id },
        data: { capacity: dto.capacity },
      });
      return this.toDto(event, count);
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const isGroup = dto.type === EVENT_TYPE.GROUP;

    await this.assertNoOverlap(dto.resourceId, startsAt, endsAt, id);

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        type: dto.type,
        resourceId: dto.resourceId,
        title: dto.title ?? null,
        capacity: dto.capacity,
        organizerName: isGroup ? dto.organizerName ?? null : null,
        organizerPhone: isGroup ? dto.organizerPhone ?? null : null,
        groupSize: isGroup ? dto.groupSize ?? null : null,
        startsAt,
        endsAt,
      },
    });
    return this.toDto(event, await this.countParticipants(id));
  }

  private countParticipants(eventId: string): Promise<number> {
    return this.prisma.eventParticipant.count({ where: { eventId } });
  }

  // Only the current author (creator or promoted owner) or an admin may delete.
  async remove(id: string, userId: number, role: Role): Promise<void> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    this.assertNotEnded(event.endsAt);
    const isAuthor = event.createdBy === BigInt(userId);
    if (role !== Role.admin && !isAuthor) {
      throw new ForbiddenException('Only the author or an admin can delete');
    }
    await this.prisma.event.delete({ where: { id } });
  }

  // A finished event is frozen: nobody (not even an admin) may edit or delete.
  private assertNotEnded(endsAt: Date): void {
    if (endsAt.getTime() <= Date.now()) {
      throw new ForbiddenException('Event has already ended');
    }
  }

  // Two events on the same resource (court) may not overlap in time.
  // Overlap: existing.startsAt < newEndsAt AND existing.endsAt > newStartsAt.
  private async assertNoOverlap(
    resourceId: number,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.event.findFirst({
      where: {
        resourceId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (conflict) {
      throw new ConflictException(
        'This court is already booked for the selected time',
      );
    }
  }

  private async assertWithinDateLimit(startsAt: Date): Promise<void> {
    const maxDaysAhead = await this.settings.getMaxDaysAhead();
    const now = EventsService.kyivDayInfo(new Date());
    const target = EventsService.kyivDayInfo(startsAt);

    // The newest day only opens at BOOKING_OPEN_HOUR; before that the window
    // is one day shorter, so popular slots aren't grabbed at midnight.
    const effectiveDaysAhead =
      now.hour < BOOKING_OPEN_HOUR ? maxDaysAhead - 1 : maxDaysAhead;
    const maxDayIndex = now.dayIndex + effectiveDaysAhead;

    if (target.dayIndex < now.dayIndex || target.dayIndex > maxDayIndex) {
      throw new ForbiddenException(
        `Events are allowed only within the next ${maxDaysAhead} days`,
      );
    }
  }

  // Calendar day (as an epoch day index) and hour of a moment in Kyiv time,
  // so the booking window is correct regardless of the server time zone.
  private static kyivDayInfo(date: Date): { dayIndex: number; hour: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string): number =>
      Number(parts.find((p) => p.type === type)?.value ?? '0');
    const dayIndex = Math.floor(
      Date.UTC(get('year'), get('month') - 1, get('day')) / 86_400_000,
    );
    return { dayIndex, hour: get('hour') };
  }

  private toDto(event: EventRow, participantCount: number): EventDto {
    return {
      id: event.id,
      type: event.type as EventDto['type'],
      resourceId: event.resourceId as ResourceId,
      title: event.title,
      capacity: event.capacity,
      participantCount,
      organizerName: event.organizerName,
      organizerPhone: event.organizerPhone,
      groupSize: event.groupSize,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      createdBy: Number(event.createdBy),
    };
  }
}
