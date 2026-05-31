import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AddGuestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[+()\d\s-]+$/, { message: 'phone must be a valid number' })
  phone!: string;
}
