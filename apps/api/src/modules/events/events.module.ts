import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SettingsModule } from '../settings/settings.module';
import { PrimeTimeModule } from '../prime-time/prime-time.module';
import { EventNotificationsModule } from '../notifications/event-notifications.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    AccessModule,
    SettingsModule,
    PrimeTimeModule,
    EventNotificationsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
