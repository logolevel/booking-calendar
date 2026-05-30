import { IsInt, Min } from 'class-validator';

export class AddParticipantDto {
  @IsInt()
  @Min(1)
  userId!: number;
}
