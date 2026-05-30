import { EVENT_TYPE, type EventType } from '@tg-calendar/shared-types';

// Temporary labels until i18n is wired up (uk).
const LABELS: Record<EventType, string> = {
  [EVENT_TYPE.WOMEN]: 'Жінки',
  [EVENT_TYPE.MEN]: 'Чоловіки',
  [EVENT_TYPE.MIXED]: 'Мікс',
  [EVENT_TYPE.INDIVIDUAL]: 'Індивідуальне',
  [EVENT_TYPE.TECH_WOMEN]: 'Техніка (жінки)',
  [EVENT_TYPE.TECH_MEN]: 'Техніка (чоловіки)',
};

export function eventTypeLabel(type: EventType): string {
  return LABELS[type];
}
