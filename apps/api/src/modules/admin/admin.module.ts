import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AccessModule, SettingsModule, TelegramModule],
  controllers: [AdminController],
})
export class AdminModule {}
