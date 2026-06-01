import { EVENT_TYPE, type EventDto } from '@tg-calendar/shared-types';
import { eventTypeLabel } from '../eventLabels';

export interface RbcEvent {
  title: string;
  start: Date;
  end: Date;
  resourceId: number;
  raw: EventDto;
  // A transient placeholder shown while picking a slot to create an event.
  isDraft?: boolean;
}

// Synthetic event rendered on the grid while the user picks a new slot.
export function draftRbcEvent(start: Date, end: Date): RbcEvent {
  return {
    title: 'Нова подія',
    start,
    end,
    resourceId: 0,
    isDraft: true,
    raw: {
      id: '__draft__',
      type: EVENT_TYPE.MIXED,
      resourceId: 0,
      capacity: 0,
      participantCount: 0,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    } as unknown as EventDto,
  };
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
