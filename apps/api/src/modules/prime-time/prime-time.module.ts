import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SettingsModule } from '../settings/settings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PrimeTimeService } from './prime-time.service';

@Module({
  imports: [AccessModule, SettingsModule, SubscriptionsModule],
  providers: [PrimeTimeService],
  exports: [PrimeTimeService],
})
export class PrimeTimeModule {}
