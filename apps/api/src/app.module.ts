import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { TelegramModule } from './modules/telegram/telegram.module';
import { MeModule } from './modules/me/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api*', '/calendar-webhook*'],
    }),
    PrismaModule,
    TelegramModule,
    MeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
