import type { MeResponse } from '@tg-calendar/shared-types';
import { apiGet } from '../../shared/api/client';

export function fetchMe(): Promise<MeResponse> {
  return apiGet<MeResponse>('/api/me');
}
