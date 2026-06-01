import { PREVIEW_ROLE_HEADER } from '@tg-calendar/shared-types';
import { getPreviewRole } from './preview';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getInitData(): string {
  return window.Telegram?.WebApp.initData ?? '';
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const preview = getPreviewRole();
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `tma ${getInitData()}`,
      ...(preview ? { [PREVIEW_ROLE_HEADER]: preview } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    // Surface the server's message (NestJS sends { message }) when present.
    let message = `Request failed with status ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      } else if (typeof data.message === 'string' && data.message) {
        message = data.message;
      }
    } catch {
      // No JSON body; keep the default message.
    }
    throw new ApiError(res.status, message);
  }

  // No-content responses (e.g. 204 from DELETE) have no JSON body.
  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}
