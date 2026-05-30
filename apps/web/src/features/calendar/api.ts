import type { CreateEventRequest, EventDto } from '@tg-calendar/shared-types';
import { apiGet, apiPost } from '../../shared/api/client';

export function fetchEvents(): Promise<EventDto[]> {
  return apiGet<EventDto[]>('/api/events');
}

export function createEvent(body: CreateEventRequest): Promise<EventDto> {
  return apiPost<EventDto>('/api/events', body);
}
