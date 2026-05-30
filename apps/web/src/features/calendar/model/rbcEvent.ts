import type { EventDto } from '@tg-calendar/shared-types';
import { eventTypeLabel } from '../eventLabels';

export interface RbcEvent {
  title: string;
  start: Date;
  end: Date;
  resourceId: number;
  raw: EventDto;
}

export function toRbcEvent(event: EventDto): RbcEvent {
  return {
    title: event.title ?? eventTypeLabel(event.type),
    start: new Date(event.startsAt),
    end: new Date(event.endsAt),
    resourceId: event.resourceId,
    raw: event,
  };
}
