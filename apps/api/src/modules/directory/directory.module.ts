import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { GuestsModule } from '../guests/guests.module';
import { UsersModule } from '../users/users.module';
import { ParticipationModule } from '../participation/participation.module';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';

@Module({
  imports: [AccessModule, GuestsModule, UsersModule, ParticipationModule],
  controllers: [DirectoryController],
  providers: [DirectoryService],
})
export class DirectoryModule {}
