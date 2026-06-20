import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { UsersModule } from '../users/users.module';
import { GuestsModule } from '../guests/guests.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TelegramModule } from '../telegram/telegram.module';
import { EventNotificationsService } from './event-notifications.service';
import { NotificationPrefsService } from './notification-prefs.service';

@Module({
  imports: [
    AccessModule,
    UsersModule,
    GuestsModule,
    SubscriptionsModule,
    TelegramModule,
  ],
  providers: [EventNotificationsService, NotificationPrefsService],
  exports: [EventNotificationsService, NotificationPrefsService],
})
export class EventNotificationsModule {}
