import type {
  CreateGuestRequest,
  EventParticipantsResponse,
  GuestDto,
  UserSearchResult,
} from '@tg-calendar/shared-types';
import {
  apiDelete,
  apiGet,
  apiPost,
} from '../../shared/api/client';

export function fetchParticipants(
  eventId: string,
): Promise<EventParticipantsResponse> {
  return apiGet<EventParticipantsResponse>(
    `/api/events/${eventId}/participants`,
  );
}

export function joinEvent(eventId: string): Promise<EventParticipantsResponse> {
  return apiPost<EventParticipantsResponse>(
    `/api/events/${eventId}/participants/me`,
    {},
  );
}

export function leaveEvent(eventId: string): Promise<EventParticipantsResponse> {
  return apiDelete<EventParticipantsResponse>(
    `/api/events/${eventId}/participants/me`,
  );
}

export function addParticipant(
  eventId: string,
  userId: number,
): Promise<EventParticipantsResponse> {
  return apiPost<EventParticipantsResponse>(
    `/api/events/${eventId}/participants`,
    { userId },
  );
}

export function removeParticipant(
  eventId: string,
  participantId: string,
): Promise<EventParticipantsResponse> {
  return apiDelete<EventParticipantsResponse>(
    `/api/events/${eventId}/participants/${participantId}`,
  );
}

export function joinWaitlist(
  eventId: string,
): Promise<EventParticipantsResponse> {
  return apiPost<EventParticipantsResponse>(
    `/api/events/${eventId}/waitlist`,
    {},
  );
}

export function leaveWaitlist(
  eventId: string,
): Promise<EventParticipantsResponse> {
  return apiDelete<EventParticipantsResponse>(
    `/api/events/${eventId}/waitlist/me`,
  );
}

export function searchUsers(q: string): Promise<UserSearchResult[]> {
  return apiGet<UserSearchResult[]>(
    `/api/users/search?q=${encodeURIComponent(q)}`,
  );
}

export function searchGuests(q: string): Promise<GuestDto[]> {
  return apiGet<GuestDto[]>(`/api/guests/search?q=${encodeURIComponent(q)}`);
}

export function addExistingGuest(
  eventId: string,
  guestId: string,
): Promise<EventParticipantsResponse> {
  return apiPost<EventParticipantsResponse>(
    `/api/events/${eventId}/participants/guest`,
    { guestId },
  );
}

export function createGuest(
  eventId: string,
  guest: CreateGuestRequest,
): Promise<EventParticipantsResponse> {
  return apiPost<EventParticipantsResponse>(
    `/api/events/${eventId}/participants/guest/new`,
    guest,
  );
}
