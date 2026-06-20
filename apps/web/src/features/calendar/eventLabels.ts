import { EVENT_TYPE, type EventType } from '@tg-calendar/shared-types';

// Temporary labels until i18n is wired up (uk).
const LABELS: Record<EventType, string> = {
  [EVENT_TYPE.WOMEN]: 'Жінки (ігрове)',
  [EVENT_TYPE.MEN]: 'Чоловіки (ігрове)',
  [EVENT_TYPE.MIXED]: 'Мікст',
  [EVENT_TYPE.INDIVIDUAL]: 'Індивідуальне',
  [EVENT_TYPE.TECH_WOMEN]: 'Жінки (технічка)',
  [EVENT_TYPE.TECH_MEN]: 'Чоловіки (технічка)',
  [EVENT_TYPE.GROUP]: 'Група',
};

export function eventTypeLabel(type: EventType): string {
  return LABELS[type];
}

// Courts are shown by colour name instead of a number.
const RESOURCE_LABELS: Record<number, string> = {
  1: 'Зелений',
  2: 'Червоний',
};

export function resourceLabel(id: number): string {
  return RESOURCE_LABELS[id] ?? `№${id}`;
}
