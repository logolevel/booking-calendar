import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEventRequest,
  UpdateEventRequest,
} from '@tg-calendar/shared-types';
import {
  createEvent,
  deleteEvent,
  fetchEvents,
  fetchPrimeQuota,
  updateEvent,
} from './api';

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });
}

// Prime-time quota snapshot for a draft slot, used by the creation form to warn
// the user before they submit. Disabled until both times are valid.
export function usePrimeQuota(
  startsAt: string | null,
  endsAt: string | null,
  resourceId: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['prime-quota', startsAt, endsAt, resourceId],
    queryFn: () =>
      fetchPrimeQuota(startsAt as string, endsAt as string, resourceId),
    enabled: enabled && Boolean(startsAt) && Boolean(endsAt),
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

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
