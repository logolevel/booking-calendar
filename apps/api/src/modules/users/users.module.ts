import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AccessModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
