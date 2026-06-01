// Calendar grid bounds and snapping for tap-to-create event drafts.
export const DAY_START_HOUR = 8;
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
