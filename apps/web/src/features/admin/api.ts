import type {
  AdminSettingsResponse,
  UpdateAdminSettingsRequest,
} from '@tg-calendar/shared-types';
import { apiGet, apiPatch } from '../../shared/api/client';

export function fetchAdminSettings(): Promise<AdminSettingsResponse> {
  return apiGet<AdminSettingsResponse>('/api/admin/settings');
}

export function updateAdminSettings(
  body: UpdateAdminSettingsRequest,
): Promise<AdminSettingsResponse> {
  return apiPatch<AdminSettingsResponse>('/api/admin/settings', body);
}
