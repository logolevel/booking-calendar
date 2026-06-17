import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { UsersModule } from '../users/users.module';
import { GuestsModule } from '../guests/guests.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PrimeTimeModule } from '../prime-time/prime-time.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EventsGateway } from '../realtime/events.gateway';
import { ParticipationController } from './participation.controller';
import { ParticipationService } from './participation.service';

@Module({
  imports: [
    AccessModule,
    UsersModule,
    GuestsModule,
    TelegramModule,
    PrimeTimeModule,
    SubscriptionsModule,
  ],
  controllers: [ParticipationController],
  providers: [ParticipationService, EventsGateway],
})
export class ParticipationModule {}
