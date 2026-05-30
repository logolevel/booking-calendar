import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEventRequest } from '@tg-calendar/shared-types';
import { createEvent, fetchEvents } from './api';

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEventRequest) => createEvent(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
