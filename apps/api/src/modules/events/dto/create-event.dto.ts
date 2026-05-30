import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EVENT_TYPE,
  MAX_CAPACITY,
  MIN_CAPACITY,
  RESOURCE_IDS,
  type EventType,
  type ResourceId,
} from '@tg-calendar/shared-types';

const EVENT_TYPES = Object.values(EVENT_TYPE);

export class CreateEventDto {
  @IsIn(EVENT_TYPES)
  type!: EventType;

  @IsIn(RESOURCE_IDS as unknown as number[])
  resourceId!: ResourceId;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsInt()
  @Min(MIN_CAPACITY)
  @Max(MAX_CAPACITY)
  capacity!: number;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;
}
