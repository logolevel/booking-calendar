import { IsIn, IsString, IsUUID, Matches } from 'class-validator';
import { GENDER, type Gender } from '@tg-calendar/shared-types';

const GENDERS = Object.values(GENDER);
// Cyrillic letters plus apostrophe/hyphen/space (Ukrainian names).
const UKRAINIAN = /^[\u0400-\u04FF'’ʼ\- ]+$/;

export class AddExistingGuestDto {
  @IsUUID()
  guestId!: string;
}

export class CreateGuestDto {
  @IsString()
  @Matches(UKRAINIAN, { message: 'firstName must be in Ukrainian' })
  firstName!: string;

  @IsString()
  @Matches(UKRAINIAN, { message: 'lastName must be in Ukrainian' })
  lastName!: string;

  @IsIn(GENDERS)
  gender!: Gender;
}
