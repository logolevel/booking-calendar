import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessService } from '../access/access.service';
import type { TelegramUpdate } from './telegram.types';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly access: AccessService,
  ) {}

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

    const text = message.text.trim();
    const chatId = message.chat.id;
    const fromId = message.from.id;

    if (text.startsWith('/start')) {
      await this.sendMessage(
        chatId,
        'Вітаю! Відкрийте календар через меню застосунку.',
      );
      return;
    }

    // Returns current chat id, useful to obtain GROUP_CHAT_ID.
    if (text.startsWith('/chatid')) {
      await this.sendMessage(chatId, `chat_id: ${chatId}`);
      return;
    }

    if (text.startsWith('/grant') || text.startsWith('/revoke')) {
      await this.handleAccessCommand(chatId, fromId, text);
    }
  }

  private async handleAccessCommand(
    chatId: number,
    fromId: number,
    text: string,
  ): Promise<void> {
    if (!this.isAdmin(fromId)) {
      return;
    }

    const [command, rawId] = text.split(/\s+/, 2);
    const targetId = Number(rawId);
    if (!Number.isInteger(targetId)) {
      await this.sendMessage(chatId, 'Usage: /grant <user_id> | /revoke <user_id>');
      return;
    }

    if (command.startsWith('/grant')) {
      await this.access.grantExternal(targetId, fromId);
      await this.sendMessage(chatId, `Granted external access to ${targetId}`);
    } else {
      await this.access.revokeExternal(targetId);
      await this.sendMessage(chatId, `Revoked access for ${targetId}`);
    }
  }

  private isAdmin(userId: number): boolean {
    const adminId = Number(this.config.get<string>('ADMIN_ID'));
    return Number.isFinite(adminId) && userId === adminId;
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
