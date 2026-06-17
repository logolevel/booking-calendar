import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UpdateUserProfileRequest,
  UsersDirectoryResponse,
} from '@tg-calendar/shared-types';
import { fetchDirectory, updateUserProfile } from './api';

export function useDirectory(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'directory'],
    queryFn: fetchDirectory,
    enabled,
    retry: false,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: number;
      body: UpdateUserProfileRequest;
    }) => updateUserProfile(userId, body),
    onSuccess: (data: UsersDirectoryResponse) => {
      queryClient.setQueryData(['admin', 'directory'], data);
      // The edited user may be the admin themselves; refresh their profile too.
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
