import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { UsersModule } from '../users/users.module';
import { GuestsModule } from '../guests/guests.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TelegramModule } from '../telegram/telegram.module';
import { EventNotificationsService } from './event-notifications.service';

@Module({
  imports: [
    AccessModule,
    UsersModule,
    GuestsModule,
    SubscriptionsModule,
    TelegramModule,
  ],
  providers: [EventNotificationsService],
  exports: [EventNotificationsService],
})
export class EventNotificationsModule {}
