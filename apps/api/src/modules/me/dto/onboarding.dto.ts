import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { GENDER, type Gender } from '@tg-calendar/shared-types';

const GENDERS = Object.values(GENDER);

export class OnboardingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @IsIn(GENDERS)
  gender!: Gender;
}
