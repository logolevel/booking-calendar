import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MeResponse } from '@tg-calendar/shared-types';
import { submitOnboarding } from './api';

export function useOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitOnboarding,
    onSuccess: (data: MeResponse) => {
      queryClient.setQueryData(['me'], data);
    },
  });
}
