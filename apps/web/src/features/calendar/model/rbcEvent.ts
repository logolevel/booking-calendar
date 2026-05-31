import { EVENT_TYPE, type EventDto } from '@tg-calendar/shared-types';
import { eventTypeLabel } from '../eventLabels';

export interface RbcEvent {
  title: string;
  start: Date;
  end: Date;
  resourceId: number;
  raw: EventDto;
}

export function toRbcEvent(event: EventDto): RbcEvent {
  const label = event.title ?? eventTypeLabel(event.type);
  // Group bookings have no roster; everyone else shows the fill count.
  const title =
    event.type === EVENT_TYPE.GROUP
      ? label
      : `${label} · ${event.participantCount}/${event.capacity}`;
  return {
    title,
    start: new Date(event.startsAt),
    end: new Date(event.endsAt),
    resourceId: event.resourceId,
    raw: event,
  };
}
