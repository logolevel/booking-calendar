import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { TelegramModule } from './modules/telegram/telegram.module';
import { MeModule } from './modules/me/me.module';
import { EventsModule } from './modules/events/events.module';
import { UsersModule } from './modules/users/users.module';
import { GuestsModule } from './modules/guests/guests.module';
import { ParticipationModule } from './modules/participation/participation.module';
import { AdminModule } from './modules/admin/admin.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { RemindersModule } from './modules/reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api*', '/calendar-webhook*'],
    }),
    PrismaModule,
    TelegramModule,
    MeModule,
    EventsModule,
    UsersModule,
    GuestsModule,
    ParticipationModule,
    AdminModule,
    SubscriptionsModule,
    DirectoryModule,
    RemindersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
