import { IsInt } from 'class-validator';

export class GrantTrainerDto {
  @IsInt()
  userId!: number;
}
