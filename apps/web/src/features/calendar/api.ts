import type {
  CreateEventRequest,
  EventDto,
  UpdateEventRequest,
} from '@tg-calendar/shared-types';
import { apiGet, apiPatch, apiPost } from '../../shared/api/client';

export function fetchEvents(): Promise<EventDto[]> {
  return apiGet<EventDto[]>('/api/events');
}

export function createEvent(body: CreateEventRequest): Promise<EventDto> {
  return apiPost<EventDto>('/api/events', body);
}

export function updateEvent(
  id: string,
  body: UpdateEventRequest,
): Promise<EventDto> {
  return apiPatch<EventDto>(`/api/events/${id}`, body);
}
