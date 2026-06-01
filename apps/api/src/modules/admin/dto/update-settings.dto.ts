import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsInt()
  @Min(1)
  @Max(365)
  maxDaysAhead!: number;

  @IsInt()
  @Min(0)
  @Max(23)
  bookingOpenHour!: number;

  @IsBoolean()
  notify!: boolean;
}
