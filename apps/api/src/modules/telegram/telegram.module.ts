import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [AccessModule, SettingsModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
