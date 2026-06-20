import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { EventNotificationsModule } from '../notifications/event-notifications.module';
import { RemindersService } from './reminders.service';

@Module({
  imports: [TelegramModule, EventNotificationsModule],
  providers: [RemindersService],
})
export class RemindersModule {}
