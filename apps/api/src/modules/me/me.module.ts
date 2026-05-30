import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { MeController } from './me.controller';

@Module({
  imports: [AccessModule],
  controllers: [MeController],
})
export class MeModule {}
