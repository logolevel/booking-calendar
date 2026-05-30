import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { VerifiedTelegramUser } from '../../auth/init-data';

interface MembershipCacheEntry {
  isMember: boolean;
  expiresAt: number;
}

interface ChatMemberResponse {
  ok: boolean;
  result?: { status: string; is_member?: boolean };
}

const MEMBER_STATUSES = new Set(['creator', 'administrator', 'member']);

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);
  private readonly membershipCache = new Map<number, MembershipCacheEntry>();
  private readonly cacheTtlMs = 10 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Effective role; null means no access.
  async resolveRole(userId: number): Promise<Role | null> {
    const adminId = Number(this.config.get<string>('ADMIN_ID'));
    if (Number.isFinite(adminId) && userId === adminId) {
      return Role.admin;
    }

    if (await this.isGroupMember(userId)) {
      return Role.member;
    }

    const external = await this.prisma.externalAccess.findUnique({
      where: { telegramId: BigInt(userId) },
    });
    if (external && !external.accessRevoked) {
      return Role.external;
    }

    return null;
  }

  async syncUser(user: VerifiedTelegramUser, role: Role): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: BigInt(user.id) },
      create: {
        id: BigInt(user.id),
        firstName: user.firstName,
        lastName: user.lastName ?? null,
        username: user.username ?? null,
        role,
      },
      update: {
        firstName: user.firstName,
        lastName: user.lastName ?? null,
        username: user.username ?? null,
        role,
      },
    });
  }

  async grantExternal(telegramId: number, grantedBy: number): Promise<void> {
    await this.prisma.externalAccess.upsert({
      where: { telegramId: BigInt(telegramId) },
      create: {
        telegramId: BigInt(telegramId),
        grantedBy: BigInt(grantedBy),
        accessRevoked: false,
      },
      update: { grantedBy: BigInt(grantedBy), accessRevoked: false },
    });
  }

  async revokeExternal(telegramId: number): Promise<void> {
    await this.prisma.externalAccess.updateMany({
      where: { telegramId: BigInt(telegramId) },
      data: { accessRevoked: true },
    });
    this.membershipCache.delete(telegramId);
  }

  private async isGroupMember(userId: number): Promise<boolean> {
    const cached = this.membershipCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.isMember;
    }

    const isMember = await this.fetchMembership(userId);
    this.membershipCache.set(userId, {
      isMember,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return isMember;
  }

  private async fetchMembership(userId: number): Promise<boolean> {
    const token = this.config.get<string>('BOT_TOKEN');
    const chatId = this.config.get<string>('GROUP_CHAT_ID');
    if (!token || !chatId) {
      this.logger.warn('BOT_TOKEN or GROUP_CHAT_ID missing, denying access');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(
        chatId,
      )}&user_id=${userId}`;
      const res = await fetch(url);
      const data = (await res.json()) as ChatMemberResponse;
      if (!data.ok || !data.result) {
        return false;
      }
      const { status, is_member: isMember } = data.result;
      if (status === 'restricted') {
        return isMember === true;
      }
      return MEMBER_STATUSES.has(status);
    } catch (error) {
      this.logger.error('getChatMember failed', error as Error);
      return false;
    }
  }
}
