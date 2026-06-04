import type { UsersDirectoryResponse } from '@tg-calendar/shared-types';
import { apiGet } from '../../shared/api/client';

export function fetchDirectory(): Promise<UsersDirectoryResponse> {
  return apiGet<UsersDirectoryResponse>('/api/admin/users');
}
