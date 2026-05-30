import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { verifyInitData, type VerifiedTelegramUser } from './init-data';

export interface AuthedRequest extends Request {
  telegramUser?: VerifiedTelegramUser;
}

function extractInitData(req: Request): string | null {
  const auth = req.header('authorization');
  if (auth?.startsWith('tma ')) {
    return auth.slice(4).trim();
  }
  const header = req.header('x-telegram-init-data');
  return header ?? null;
}

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const initData = extractInitData(req);
    if (!initData) {
      throw new UnauthorizedException('Missing Telegram init data');
    }

    const botToken = this.config.get<string>('BOT_TOKEN');
    if (!botToken) {
      throw new UnauthorizedException('Server is not configured');
    }

    const verified = verifyInitData(initData, botToken);
    if (!verified) {
      throw new UnauthorizedException('Invalid Telegram init data');
    }

    req.telegramUser = verified.user;
    return true;
  }
}
