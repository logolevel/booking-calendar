import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';
import { EventsGateway } from '../realtime/events.gateway';
import { ParticipationController } from './participation.controller';
import { ParticipationService } from './participation.service';

@Module({
  imports: [AccessModule, UsersModule, TelegramModule],
  controllers: [ParticipationController],
  providers: [ParticipationService, EventsGateway],
})
export class ParticipationModule {}
