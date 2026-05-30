import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { GENDER, type Gender } from '@tg-calendar/shared-types';

const GENDERS = Object.values(GENDER);

// Cyrillic letters plus apostrophe/hyphen/space (Ukrainian names).
const UKRAINIAN = /^[\u0400-\u04FF'’ʼ\- ]+$/;

export class OnboardingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(UKRAINIAN, { message: 'firstName must be in Ukrainian' })
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(UKRAINIAN, { message: 'lastName must be in Ukrainian' })
  lastName!: string;

  @IsIn(GENDERS)
  gender!: Gender;
}
