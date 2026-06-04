import { IsInt } from 'class-validator';

export class GrantAdminDto {
  @IsInt()
  userId!: number;
}
