import type { PreviewMode } from '@tg-calendar/shared-types';

// Admin-only role preview. Stored outside React so the API client can read it
// synchronously when building request headers.
let current: PreviewMode | null = null;
const listeners = new Set<() => void>();

export function getPreviewRole(): PreviewMode | null {
  return current;
}

export function setPreviewRole(role: PreviewMode | null): void {
  current = role;
  listeners.forEach((listener) => listener());
}

export function subscribePreviewRole(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
