import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  SUBSCRIPTION_MAX_MONTHS,
  SUBSCRIPTION_MIN_MONTHS,
} from '@tg-calendar/shared-types';

export class CreateSubscriptionDto {
  @IsInt()
  userId!: number;

  @IsInt()
  @Min(SUBSCRIPTION_MIN_MONTHS)
  @Max(SUBSCRIPTION_MAX_MONTHS)
  months!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
