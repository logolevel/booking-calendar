import { IsBoolean, IsInt, Matches, Max, Min } from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateSettingsDto {
  @IsInt()
  @Min(1)
  @Max(365)
  maxDaysAhead!: number;

  @IsInt()
  @Min(0)
  @Max(23)
  bookingOpenHour!: number;

  @Matches(HH_MM, { message: 'primeStart must be HH:MM' })
  primeStart!: string;

  @Matches(HH_MM, { message: 'primeEnd must be HH:MM' })
  primeEnd!: string;

  @IsBoolean()
  notify!: boolean;
}
