import { useQuery } from '@tanstack/react-query';
import type { StatsResponse } from '@tg-calendar/shared-types';
import { fetchStats } from './api';

export function useStats(
  from: string,
  to: string,
  enabled = true,
): {
  data: StatsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  return useQuery({
    queryKey: ['admin', 'stats', from, to],
    queryFn: () => fetchStats(from, to),
    enabled: enabled && Boolean(from) && Boolean(to),
    staleTime: 60_000,
  });
}
