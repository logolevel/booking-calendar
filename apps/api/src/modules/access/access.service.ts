import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PREVIEW_MODE } from '@tg-calendar/shared-types';
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

  // The immutable super-admin from the environment (cannot be revoked).
  isRoot(userId: number): boolean {
    const adminId = Number(this.config.get<string>('ADMIN_ID'));
    return Number.isFinite(adminId) && userId === adminId;
  }

  // Effective role; null means no access.
  async resolveRole(userId: number): Promise<Role | null> {
    if (this.isRoot(userId)) {
      return Role.admin;
    }

    // DB-assigned admins stay admin even outside the group.
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { isAdmin: true },
    });
    if (user?.isAdmin) {
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

  // Apply a previewed role, but only when the real user is an admin.
  // This prevents non-admins from escalating via the preview header. The
  // "subscriber" mode previews a member (role-wise) holding a subscription, so
  // it resolves to the member role; its perks are reported via previewSubscriber.
  applyPreview(realRole: Role | null, preview?: string | null): Role | null {
    if (realRole !== Role.admin || !preview) {
      return realRole;
    }
    if (
      preview === Role.admin ||
      preview === Role.member ||
      preview === Role.external
    ) {
      return preview;
    }
    if (preview === PREVIEW_MODE.SUBSCRIBER) {
      return Role.member;
    }
    return realRole;
  }

  // Subscription status to report under a preview; undefined means "use the
  // real value". Lets an admin emulate a subscriber (true) or a plain
  // member/guest without subscription perks (false). Admin-only, like the role.
  previewSubscriber(
    realRole: Role | null,
    preview?: string | null,
  ): boolean | undefined {
    if (realRole !== Role.admin || !preview) {
      return undefined;
    }
    if (preview === PREVIEW_MODE.SUBSCRIBER) {
      return true;
    }
    if (preview === Role.member || preview === Role.external) {
      return false;
    }
    return undefined;
  }

  // Trainer flag to report under a preview; undefined means "use the real value".
  // "trainer" mode previews a member with trainer permissions. Admin-only.
  previewTrainer(
    realRole: Role | null,
    preview?: string | null,
  ): boolean | undefined {
    if (realRole !== Role.admin || !preview) {
      return undefined;
    }
    if (preview === PREVIEW_MODE.TRAINER) {
      return true;
    }
    if (
      preview === Role.member ||
      preview === Role.external ||
      preview === PREVIEW_MODE.SUBSCRIBER
    ) {
      return false;
    }
    return undefined;
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
      // Do not overwrite firstName/lastName: they may be set during onboarding.
      update: {
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

  // Telegram ids of every admin: root (env) plus everyone flagged in the DB.
  async listAdminIds(): Promise<number[]> {
    const rows = await this.prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });
    const ids = rows.map((r) => Number(r.id));
    const adminId = Number(this.config.get<string>('ADMIN_ID'));
    if (Number.isFinite(adminId) && !ids.includes(adminId)) {
      ids.unshift(adminId);
    }
    return ids;
  }

  // Promote an existing user (must have interacted with the bot/Mini App).
  async grantAdmin(targetId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(targetId) },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id: BigInt(targetId) },
      data: { isAdmin: true },
    });
    this.membershipCache.delete(targetId);
  }

  // Demote an admin. The root admin (env) can never be revoked.
  async revokeAdmin(targetId: number): Promise<void> {
    if (this.isRoot(targetId)) {
      throw new ForbiddenException('Cannot revoke the root admin');
    }
    await this.prisma.user.updateMany({
      where: { id: BigInt(targetId) },
      data: { isAdmin: false },
    });
    this.membershipCache.delete(targetId);
  }

  async isTrainerUser(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { isTrainer: true },
    });
    return user?.isTrainer ?? false;
  }

  async listTrainerIds(): Promise<number[]> {
    const rows = await this.prisma.user.findMany({
      where: { isTrainer: true },
      select: { id: true },
    });
    return rows.map((r) => Number(r.id));
  }

  async grantTrainer(targetId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(targetId) },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id: BigInt(targetId) },
      data: { isTrainer: true },
    });
  }

  async revokeTrainer(targetId: number): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: BigInt(targetId) },
      data: { isTrainer: false },
    });
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
