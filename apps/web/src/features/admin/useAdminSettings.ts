import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminSettings, updateAdminSettings } from './api';

export function useAdminSettings(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: fetchAdminSettings,
    enabled,
    retry: false,
  });
}

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminSettings,
    onSuccess: () => {
      // The window rules changed; refresh both the profile and admin view.
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });
}
