import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifiedTelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

export interface VerifiedInitData {
  user: VerifiedTelegramUser;
  authDate: number;
}

interface RawTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

function isRawUser(value: unknown): value is RawTelegramUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.first_name === 'string'
  );
}

// Validate Telegram WebApp initData per https://core.telegram.org/bots/webapps#validating-data
export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86_400,
): VerifiedInitData | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    return null;
  }
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const computedBuf = Buffer.from(computed, 'hex');
  const hashBuf = Buffer.from(hash, 'hex');
  if (
    computedBuf.length !== hashBuf.length ||
    !timingSafeEqual(computedBuf, hashBuf)
  ) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) {
    return null;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - authDate > maxAgeSeconds) {
    return null;
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(userRaw);
  } catch {
    return null;
  }
  if (!isRawUser(parsed)) {
    return null;
  }

  return {
    authDate,
    user: {
      id: parsed.id,
      firstName: parsed.first_name,
      lastName: parsed.last_name,
      username: parsed.username,
      languageCode: parsed.language_code,
    },
  };
}
