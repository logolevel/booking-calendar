import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TelegramUpdate } from './telegram.types';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiBase(): string {
    const token = this.config.get<string>('BOT_TOKEN');
    if (!token) {
      throw new Error('BOT_TOKEN is not configured');
    }
    return `https://api.telegram.org/bot${token}`;
  }

  // Tell Telegram to deliver updates to our webhook endpoint.
  async registerWebhook(): Promise<void> {
    const webhookUrl = this.config.get<string>('WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.warn('WEBHOOK_URL is not set, skipping webhook registration');
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, drop_pending_updates: false }),
      });
      const data: unknown = await res.json();
      this.logger.log(`setWebhook -> ${JSON.stringify(data)}`);
    } catch (error) {
      this.logger.error('Failed to register webhook', error as Error);
    }
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text || !message.from) {
      return;
    }

    if (message.text.startsWith('/start')) {
      await this.sendMessage(
        message.chat.id,
        'Вітаю! Відкрийте календар через меню застосунку.',
      );
    }
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    try {
      await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (error) {
      this.logger.error('Failed to send message', error as Error);
    }
  }
}
