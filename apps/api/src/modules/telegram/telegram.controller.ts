import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import type { TelegramUpdate } from './telegram.types';

// Path matches WEBHOOK_URL: https://<domain>/calendar-webhook
@Controller('calendar-webhook')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post()
  @HttpCode(200)
  async handleUpdate(@Body() update: TelegramUpdate): Promise<{ ok: true }> {
    await this.telegram.handleUpdate(update);
    return { ok: true };
  }
}
