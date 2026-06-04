import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdmins, grantAdmin, revokeAdmin } from './api';

const ADMINS_KEY = ['admin', 'admins'];

export function useAdmins(enabled: boolean) {
  return useQuery({
    queryKey: ADMINS_KEY,
    queryFn: fetchAdmins,
    enabled,
    retry: false,
  });
}

export function useGrantAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: grantAdmin,
    onSuccess: (data) => {
      queryClient.setQueryData(ADMINS_KEY, data);
    },
  });
}

export function useRevokeAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeAdmin,
    onSuccess: (data) => {
      queryClient.setQueryData(ADMINS_KEY, data);
    },
  });
}
