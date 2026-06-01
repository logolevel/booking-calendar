import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { SettingsService } from '../settings/settings.service';
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
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
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

    if (text.startsWith('/get_max_days')) {
      const days = await this.settings.getMaxDaysAhead();
      await this.sendMessage(chatId, `maxDaysAhead: ${days}`);
      return;
    }

    if (text.startsWith('/set_max_days')) {
      await this.handleSetMaxDays(chatId, fromId, text);
      return;
    }

    if (text.startsWith('/get_open_hour')) {
      const hour = await this.settings.getBookingOpenHour();
      await this.sendMessage(chatId, `bookingOpenHour: ${hour}`);
      return;
    }

    if (text.startsWith('/set_open_hour')) {
      await this.handleSetOpenHour(chatId, fromId, text);
      return;
    }

    if (text.startsWith('/grant') || text.startsWith('/revoke')) {
      await this.handleAccessCommand(chatId, fromId, text);
    }
  }

  private async handleSetMaxDays(
    chatId: number,
    fromId: number,
    text: string,
  ): Promise<void> {
    if (!this.isAdmin(fromId)) {
      return;
    }
    const [, rawDays] = text.split(/\s+/, 2);
    const days = Number(rawDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      await this.sendMessage(chatId, 'Usage: /set_max_days <1..365>');
      return;
    }
    await this.settings.setMaxDaysAhead(days);
    await this.sendMessage(chatId, `maxDaysAhead set to ${days}`);
    await this.broadcastToUsers(
      `📅 Період запису змінено: тепер можна бронювати на ${days} дн. наперед.`,
    );
  }

  private async handleSetOpenHour(
    chatId: number,
    fromId: number,
    text: string,
  ): Promise<void> {
    if (!this.isAdmin(fromId)) {
      return;
    }
    const [, rawHour] = text.split(/\s+/, 2);
    const hour = Number(rawHour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      await this.sendMessage(chatId, 'Usage: /set_open_hour <0..23>');
      return;
    }
    await this.settings.setBookingOpenHour(hour);
    await this.sendMessage(chatId, `bookingOpenHour set to ${hour}`);
    const hh = String(hour).padStart(2, '0');
    await this.broadcastToUsers(
      `⏰ Час відкриття запису змінено: найдальніший день тепер відкривається о ${hh}:00.`,
    );
  }

  // Best-effort private message to every registered user (skips those who
  // never started the bot in a private chat — Telegram rejects those sends).
  async broadcastToUsers(text: string): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      await this.sendMessage(Number(user.id), text);
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

  // Best-effort private message to a user (works only if they started the bot).
  async notifyUser(userId: number, text: string): Promise<void> {
    await this.sendMessage(userId, text);
  }

  async notifyAdmin(text: string): Promise<void> {
    const adminId = Number(this.config.get<string>('ADMIN_ID'));
    if (Number.isFinite(adminId)) {
      await this.sendMessage(adminId, text);
    }
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    await this.callApi('sendMessage', { chat_id: chatId, text });
  }
}
