import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEventRequest,
  UpdateEventRequest,
} from '@tg-calendar/shared-types';
import { createEvent, fetchEvents, updateEvent } from './api';

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

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateEventRequest }) =>
      updateEvent(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
