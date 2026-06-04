import type {
  AdminListResponse,
  AdminSettingsResponse,
  UpdateAdminSettingsRequest,
} from '@tg-calendar/shared-types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../shared/api/client';

export function fetchAdminSettings(): Promise<AdminSettingsResponse> {
  return apiGet<AdminSettingsResponse>('/api/admin/settings');
}

export function updateAdminSettings(
  body: UpdateAdminSettingsRequest,
): Promise<AdminSettingsResponse> {
  return apiPatch<AdminSettingsResponse>('/api/admin/settings', body);
}

export function fetchAdmins(): Promise<AdminListResponse> {
  return apiGet<AdminListResponse>('/api/admin/admins');
}

export function grantAdmin(userId: number): Promise<AdminListResponse> {
  return apiPost<AdminListResponse>('/api/admin/admins', { userId });
}

export function revokeAdmin(userId: number): Promise<AdminListResponse> {
  return apiDelete<AdminListResponse>(`/api/admin/admins/${userId}`);
}
