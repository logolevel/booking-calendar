import type {
  UpdateUserProfileRequest,
  UsersDirectoryResponse,
} from '@tg-calendar/shared-types';
import { apiDelete, apiGet, apiPatch } from '../../shared/api/client';

export function fetchDirectory(): Promise<UsersDirectoryResponse> {
  return apiGet<UsersDirectoryResponse>('/api/admin/users');
}

export function updateUserProfile(
  userId: number,
  body: UpdateUserProfileRequest,
): Promise<UsersDirectoryResponse> {
  return apiPatch<UsersDirectoryResponse>(`/api/admin/users/${userId}`, body);
}

export function deleteUser(userId: number): Promise<UsersDirectoryResponse> {
  return apiDelete<UsersDirectoryResponse>(`/api/admin/users/${userId}`);
}

export function deleteGuest(guestId: string): Promise<UsersDirectoryResponse> {
  return apiDelete<UsersDirectoryResponse>(
    `/api/admin/users/guests/${guestId}`,
  );
}
