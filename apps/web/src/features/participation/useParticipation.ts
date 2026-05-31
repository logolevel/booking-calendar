import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGuestRequest,
  EventParticipantsResponse,
} from '@tg-calendar/shared-types';
import {
  addExistingGuest,
  addParticipant,
  createGuest,
  fetchParticipants,
  joinEvent,
  joinWaitlist,
  leaveEvent,
  leaveWaitlist,
  removeParticipant,
  searchGuests,
  searchUsers,
} from './api';

const participantsKey = (eventId: string): [string, string] => [
  'participants',
  eventId,
];

export function useEventParticipants(eventId: string) {
  return useQuery({
    queryKey: participantsKey(eventId),
    queryFn: () => fetchParticipants(eventId),
    enabled: Boolean(eventId),
  });
}

export function useParticipationActions(eventId: string) {
  const queryClient = useQueryClient();

  const onSuccess = (data: EventParticipantsResponse): void => {
    queryClient.setQueryData(participantsKey(eventId), data);
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const join = useMutation({ mutationFn: () => joinEvent(eventId), onSuccess });
  const leave = useMutation({ mutationFn: () => leaveEvent(eventId), onSuccess });
  const add = useMutation({
    mutationFn: (userId: number) => addParticipant(eventId, userId),
    onSuccess,
  });
  const addGuest = useMutation({
    mutationFn: (guestId: string) => addExistingGuest(eventId, guestId),
    onSuccess,
  });
  const createNewGuest = useMutation({
    mutationFn: (guest: CreateGuestRequest) => createGuest(eventId, guest),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (participantId: string) =>
      removeParticipant(eventId, participantId),
    onSuccess,
  });
  const queue = useMutation({
    mutationFn: () => joinWaitlist(eventId),
    onSuccess,
  });
  const unqueue = useMutation({
    mutationFn: () => leaveWaitlist(eventId),
    onSuccess,
  });

  const isPending =
    join.isPending ||
    leave.isPending ||
    add.isPending ||
    addGuest.isPending ||
    createNewGuest.isPending ||
    remove.isPending ||
    queue.isPending ||
    unqueue.isPending;

  return {
    join,
    leave,
    add,
    addGuest,
    createNewGuest,
    remove,
    queue,
    unqueue,
    isPending,
  };
}

export function useUserSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['user-search', q],
    queryFn: () => searchUsers(q),
    enabled: q.length >= 2,
  });
}

export function useGuestSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['guest-search', q],
    queryFn: () => searchGuests(q),
    enabled: q.length >= 2,
  });
}
