import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTrainers, grantTrainer, revokeTrainer } from './api';

const TRAINERS_KEY = ['admin', 'trainers'];

export function useTrainers(enabled: boolean) {
  return useQuery({
    queryKey: TRAINERS_KEY,
    queryFn: fetchTrainers,
    enabled,
    retry: false,
  });
}

export function useGrantTrainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: grantTrainer,
    onSuccess: (data) => {
      queryClient.setQueryData(TRAINERS_KEY, data);
    },
  });
}

export function useRevokeTrainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeTrainer,
    onSuccess: (data) => {
      queryClient.setQueryData(TRAINERS_KEY, data);
    },
  });
}
