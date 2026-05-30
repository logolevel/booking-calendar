import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import {
  DEFAULT_CAPACITY,
  EVENT_TYPE,
  MAX_CAPACITY,
  MIN_CAPACITY,
  RESOURCE_IDS,
  type EventType,
  type ResourceId,
} from '@tg-calendar/shared-types';
import { useCreateEvent } from '../useEvents';
import { eventTypeLabel } from '../eventLabels';
import { Button } from '../../../shared/ui/Button';

const EVENT_TYPES = Object.values(EVENT_TYPE);
const CAPACITY_OPTIONS = Array.from(
  { length: MAX_CAPACITY - MIN_CAPACITY + 1 },
  (_, i) => MIN_CAPACITY + i,
);

// datetime-local string with minutes forced to :00 (events start on the hour).
const HOUR_PATTERN = "yyyy-MM-dd'T'HH:00";

function nextHour(offsetHours = 0): string {
  const d = new Date();
  d.setHours(d.getHours() + 1 + offsetHours, 0, 0, 0);
  return format(d, HOUR_PATTERN);
}

function toHourString(value: string): string {
  return value ? `${value.slice(0, 13)}:00` : value;
}

interface Props {
  onClose: () => void;
}

export function CreateEventForm({ onClose }: Props): JSX.Element {
  const [type, setType] = useState<EventType>(EVENT_TYPE.MIXED);
  const [resourceId, setResourceId] = useState<ResourceId>(RESOURCE_IDS[0]);
  const [capacity, setCapacity] = useState<number>(DEFAULT_CAPACITY);
  const [startsAt, setStartsAt] = useState<string>(() => nextHour());
  const [endsAt, setEndsAt] = useState<string>(() => nextHour(1));
  const createEvent = useCreateEvent();

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!startsAt || !endsAt) {
      return;
    }
    createEvent.mutate(
      {
        type,
        resourceId,
        capacity,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span className="field__label">Тип</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as EventType)}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {eventTypeLabel(t)}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Площадка</span>
        <select
          value={resourceId}
          onChange={(e) => setResourceId(Number(e.target.value) as ResourceId)}
        >
          {RESOURCE_IDS.map((id) => (
            <option key={id} value={id}>
              №{id}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Ліміт учасників</span>
        <select
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        >
          {CAPACITY_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Початок</span>
        <input
          type="datetime-local"
          step={3600}
          value={startsAt}
          onChange={(e) => setStartsAt(toHourString(e.target.value))}
        />
      </label>

      <label className="field">
        <span className="field__label">Кінець</span>
        <input
          type="datetime-local"
          step={3600}
          value={endsAt}
          onChange={(e) => setEndsAt(toHourString(e.target.value))}
        />
      </label>

      {createEvent.isError && (
        <p className="form__error">
          Не вдалося створити подію (можливо, дата поза дозволеним діапазоном).
        </p>
      )}

      <div className="form__actions">
        <Button variant="secondary" block onClick={onClose}>
          Скасувати
        </Button>
        <Button type="submit" block disabled={createEvent.isPending}>
          Зберегти
        </Button>
      </div>
    </form>
  );
}
