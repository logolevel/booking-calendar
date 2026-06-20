import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotificationSettings,
  updateNotificationSettings,
} from './api';

const KEY = ['admin', 'notifications'];

export function useNotificationSettings(enabled: boolean) {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchNotificationSettings,
    enabled,
    retry: false,
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(KEY, data);
    },
  });
}
