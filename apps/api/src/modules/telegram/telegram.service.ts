import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessService } from '../access/access.service';
import type { TelegramUpdate } from './telegram.types';

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private cachedUsername: string | null = null;

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

  private async callApi<T = unknown>(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<TelegramApiResponse<T> | null> {
    try {
      const res = await fetch(`${this.apiBase}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return (await res.json()) as TelegramApiResponse<T>;
    } catch (error) {
      this.logger.error(`Telegram API ${method} failed`, error as Error);
      return null;
    }
  }

  // Tell Telegram to deliver updates to our webhook endpoint.
  async registerWebhook(): Promise<void> {
    const webhookUrl = this.config.get<string>('WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.warn('WEBHOOK_URL is not set, skipping webhook registration');
      return;
    }
    const data = await this.callApi('setWebhook', {
      url: webhookUrl,
      drop_pending_updates: false,
    });
    this.logger.log(`setWebhook -> ${JSON.stringify(data)}`);
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

    // Admin posts a pinned button that opens the Mini App in this chat.
    if (text.startsWith('/post_calendar')) {
      if (this.isAdmin(fromId)) {
        await this.postCalendarButton(chatId);
      }
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
      await this.sendMessage(
        chatId,
        'Usage: /grant <user_id> | /revoke <user_id>',
      );
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

  private async postCalendarButton(chatId: number): Promise<void> {
    const deepLink = await this.getMiniAppDeepLink();
    if (!deepLink) {
      await this.sendMessage(
        chatId,
        'Mini App link is not configured (set WEBAPP_DEEP_LINK).',
      );
      return;
    }

    const sent = await this.callApi<{ message_id: number }>('sendMessage', {
      chat_id: chatId,
      text: 'Натисніть, щоб відкрити календар бронювань 👇',
      reply_markup: {
        inline_keyboard: [[{ text: '📅 Відкрити календар', url: deepLink }]],
      },
    });

    const messageId = sent?.result?.message_id;
    if (messageId) {
      await this.callApi('pinChatMessage', {
        chat_id: chatId,
        message_id: messageId,
        disable_notification: true,
      });
    }
  }

  // Prefer an explicit deep link; otherwise build it from the bot username.
  private async getMiniAppDeepLink(): Promise<string | null> {
    const explicit = this.config.get<string>('WEBAPP_DEEP_LINK');
    if (explicit) {
      return explicit;
    }
    const username = await this.getBotUsername();
    return username ? `https://t.me/${username}?startapp` : null;
  }

  private async getBotUsername(): Promise<string | null> {
    if (this.cachedUsername) {
      return this.cachedUsername;
    }
    const data = await this.callApi<{ username?: string }>('getMe', {});
    this.cachedUsername = data?.result?.username ?? null;
    return this.cachedUsername;
  }

  private isAdmin(userId: number): boolean {
    const adminId = Number(this.config.get<string>('ADMIN_ID'));
    return Number.isFinite(adminId) && userId === adminId;
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    await this.callApi('sendMessage', { chat_id: chatId, text });
  }
}
