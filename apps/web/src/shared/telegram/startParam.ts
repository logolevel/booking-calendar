const EVENT_PREFIX = 'event_';

// When the Mini App is opened via an event deep link
// (https://t.me/<bot>?startapp=event_<id>), return that event id so the app can
// jump straight to the event roster. Returns null for any other launch.
export function getStartEventId(): string | null {
  const param = window.Telegram?.WebApp.initDataUnsafe?.start_param;
  if (!param || !param.startsWith(EVENT_PREFIX)) {
    return null;
  }
  const id = param.slice(EVENT_PREFIX.length);
  return id || null;
}
