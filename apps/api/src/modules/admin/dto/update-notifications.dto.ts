import { IsBoolean } from 'class-validator';

export class UpdateNotificationsDto {
  @IsBoolean()
  createDelete!: boolean;

  @IsBoolean()
  roster!: boolean;

  @IsBoolean()
  other!: boolean;
}
