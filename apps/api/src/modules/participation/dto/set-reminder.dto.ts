import { IsBoolean } from 'class-validator';

export class SetReminderDto {
  @IsBoolean()
  enabled!: boolean;
}
