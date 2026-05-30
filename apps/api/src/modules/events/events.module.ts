import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SettingsModule } from '../settings/settings.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AccessModule, SettingsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
