import { useQuery } from '@tanstack/react-query';
import { fetchDirectory } from './api';

export function useDirectory(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'directory'],
    queryFn: fetchDirectory,
    enabled,
    retry: false,
  });
}
