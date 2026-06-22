import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { EventNotificationsModule } from '../notifications/event-notifications.module';
import { AdminController } from './admin.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    AccessModule,
    SettingsModule,
    TelegramModule,
    UsersModule,
    EventNotificationsModule,
  ],
  controllers: [AdminController],
  providers: [StatsService],
})
export class AdminModule {}
