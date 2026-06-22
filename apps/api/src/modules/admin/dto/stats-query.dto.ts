import { IsDateString, IsOptional, IsIn } from 'class-validator';
import type { StatsCategory } from '@tg-calendar/shared-types';

const CATEGORIES: StatsCategory[] = ['all', 'regular', 'group', 'children', 'no_sub'];

export class StatsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: StatsCategory;
}
