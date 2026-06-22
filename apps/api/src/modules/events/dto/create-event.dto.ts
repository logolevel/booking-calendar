import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
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

  // Group events only: organizer name and optional contact phone.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  organizerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  // Accepts Ukrainian mobile/landline numbers in common formats:
  // +380XXXXXXXXX, 0XXXXXXXXX, 380XXXXXXXXX, optionally with spaces/dashes/parens.
  @Matches(
    /^\+?3?8?0[\s-]?(\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\(?\d{3}\)?[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}|\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4})$/,
    { message: 'Номер телефону має бути українським (+380...)' },
  )
  organizerPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  groupSize?: number;

  // Children events only: adults (18+) head count for billing.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  adultsCount?: number;

  // Admin only: skip auto-joining the creator.
  @IsOptional()
  @IsBoolean()
  skipSelf?: boolean;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;
}
