import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { AuthedRequest } from './telegram-auth.guard';
import type { VerifiedTelegramUser } from './init-data';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): VerifiedTelegramUser => {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.telegramUser) {
      throw new InternalServerErrorException(
        'CurrentUser used without TelegramAuthGuard',
      );
    }
    return req.telegramUser;
  },
);
