import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelSubscription,
  createSubscription,
  fetchSubscriptions,
} from './api';

const SUBSCRIPTIONS_KEY = ['admin', 'subscriptions'];

export function useSubscriptions(enabled: boolean) {
  return useQuery({
    queryKey: SUBSCRIPTIONS_KEY,
    queryFn: fetchSubscriptions,
    enabled,
    retry: false,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSubscription,
    onSuccess: (data) => {
      queryClient.setQueryData(SUBSCRIPTIONS_KEY, data);
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (data) => {
      queryClient.setQueryData(SUBSCRIPTIONS_KEY, data);
    },
  });
}
