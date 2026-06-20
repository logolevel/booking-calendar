// Calendar grid bounds and snapping for tap-to-create event drafts.
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 23;
export const STEP_MIN = 30;
export const DEFAULT_DURATION_MIN = 120;

const STEP_MS = STEP_MIN * 60 * 1000;

function withTime(ref: Date, hour: number, minute: number): Date {
  const d = new Date(ref);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Round to the nearest 30-minute mark (:00 / :30).
export function snap30(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return new Date(Math.round(d.getTime() / STEP_MS) * STEP_MS);
}

export function addStep(date: Date, steps: number): Date {
  return new Date(date.getTime() + steps * STEP_MS);
}

// Keep the start inside [DAY_START, DAY_END - 30min] of its own day.
export function clampStart(date: Date): Date {
  const dayStart = withTime(date, DAY_START_HOUR, 0);
  const lastStart = withTime(date, DAY_END_HOUR - 1, STEP_MIN);
  if (date < dayStart) return dayStart;
  if (date > lastStart) return lastStart;
  return date;
}

// Keep the end after the start (≥ 30min) and within the day end.
export function clampEnd(start: Date, end: Date): Date {
  const minEnd = addStep(start, 1);
  const dayEnd = withTime(start, DAY_END_HOUR, 0);
  if (end < minEnd) return minEnd;
  if (end > dayEnd) return dayEnd;
  return end;
}

export function dayStartOf(date: Date): Date {
  return withTime(date, DAY_START_HOUR, 0);
}

export function dayEndOf(date: Date): Date {
  return withTime(date, DAY_END_HOUR, 0);
}

// Parse an "HH:MM" string into minutes-of-day; null when malformed.
export function parseHhMm(hhmm: string): number | null {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// Prime-time applies on weekdays (Mon–Fri) only; weekends are free.
export function isWeekday(date: Date): boolean {
  const dow = date.getDay();
  return dow >= 1 && dow <= 5;
}

// True when a 30-minute slot starting at `date` sits inside the prime window.
// Weekend slots are never prime.
export function isPrimeSlot(
  date: Date,
  primeStartMin: number,
  primeEndMin: number,
): boolean {
  if (!isWeekday(date)) return false;
  const min = minutesOfDay(date);
  return min >= primeStartMin && min < primeEndMin;
}

// True when the [start, end) range overlaps the prime window (same day).
// Weekend ranges never overlap prime.
export function overlapsPrime(
  start: Date,
  end: Date,
  primeStartMin: number,
  primeEndMin: number,
): boolean {
  if (!isWeekday(start)) return false;
  return minutesOfDay(start) < primeEndMin && minutesOfDay(end) > primeStartMin;
}

// Whether the regular-member access gate is already open for an event starting
// at `eventStart`: it opens at `memberOpenHour` on the day before the event.
// Subscribers and admins bypass this and are handled by the caller.
export function memberGateOpen(
  eventStart: Date,
  memberOpenHour: number,
  now: Date = new Date(),
): boolean {
  const open = new Date(eventStart);
  open.setDate(open.getDate() - 1);
  open.setHours(memberOpenHour, 0, 0, 0);
  return now.getTime() >= open.getTime();
}
