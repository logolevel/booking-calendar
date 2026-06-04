import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SettingsModule } from '../settings/settings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [AccessModule, SettingsModule, SubscriptionsModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
