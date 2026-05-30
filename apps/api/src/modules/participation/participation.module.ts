import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { UsersModule } from '../users/users.module';
import { ParticipationController } from './participation.controller';
import { ParticipationService } from './participation.service';

@Module({
  imports: [AccessModule, UsersModule],
  controllers: [ParticipationController],
  providers: [ParticipationService],
})
export class ParticipationModule {}
