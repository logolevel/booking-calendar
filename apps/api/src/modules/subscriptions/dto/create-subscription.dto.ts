import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { SUBSCRIPTION_ALLOWED_MONTHS } from '@tg-calendar/shared-types';

export class CreateSubscriptionDto {
  @IsInt()
  userId!: number;

  @IsIn(SUBSCRIPTION_ALLOWED_MONTHS as unknown as number[])
  months!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
