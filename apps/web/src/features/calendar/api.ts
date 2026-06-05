import type {
  CreateEventRequest,
  EventDto,
  PrimeQuotaPreviewResponse,
  UpdateEventRequest,
} from '@tg-calendar/shared-types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../shared/api/client';

export function fetchEvents(): Promise<EventDto[]> {
  return apiGet<EventDto[]>('/api/events');
}

export function fetchPrimeQuota(
  startsAt: string,
  endsAt: string,
  resourceId: number,
): Promise<PrimeQuotaPreviewResponse> {
  const params = new URLSearchParams({
    startsAt,
    endsAt,
    resourceId: String(resourceId),
  });
  return apiGet<PrimeQuotaPreviewResponse>(
    `/api/events/prime-quota?${params.toString()}`,
  );
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

export function deleteEvent(id: string): Promise<void> {
  return apiDelete<void>(`/api/events/${id}`);
}
