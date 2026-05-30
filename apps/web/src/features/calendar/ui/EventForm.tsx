import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import {
  DEFAULT_CAPACITY,
  EVENT_TYPE,
  MAX_CAPACITY,
  MIN_CAPACITY,
  RESOURCE_IDS,
  type EventDto,
  type EventType,
  type ResourceId,
} from '@tg-calendar/shared-types';
import { useCreateEvent, useUpdateEvent } from '../useEvents';
import { eventTypeLabel } from '../eventLabels';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';

const EVENT_TYPES = Object.values(EVENT_TYPE);
const CAPACITY_OPTIONS = Array.from(
  { length: MAX_CAPACITY - MIN_CAPACITY + 1 },
  (_, i) => MIN_CAPACITY + i,
);

// Typical training length; the end time is suggested as start + this.
const DEFAULT_DURATION_HOURS = 2;
const LOCAL_PATTERN = "yyyy-MM-dd'T'HH:mm";

// Current time rounded down to the start of the hour (:00).
function currentHour(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return format(d, LOCAL_PATTERN);
}

function toLocalInput(iso: string): string {
  return format(new Date(iso), LOCAL_PATTERN);
}

function addHours(value: string, hours: number): string {
  if (!value) {
    return '';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  d.setHours(d.getHours() + hours);
  return format(d, LOCAL_PATTERN);
}

interface Props {
  event?: EventDto;
  onClose: () => void;
}

export function EventForm({ event, onClose }: Props): JSX.Element {
  const isEdit = Boolean(event);
  const [type, setType] = useState<EventType>(event?.type ?? EVENT_TYPE.MIXED);
  const [resourceId, setResourceId] = useState<ResourceId>(
    event?.resourceId ?? RESOURCE_IDS[0],
  );
  const [capacity, setCapacity] = useState<number>(
    event?.capacity ?? DEFAULT_CAPACITY,
  );
  const [startsAt, setStartsAt] = useState<string>(
    event ? toLocalInput(event.startsAt) : currentHour(),
  );
  const [endsAt, setEndsAt] = useState<string>(
    event ? toLocalInput(event.endsAt) : '',
  );
  // The end field stays disabled until the user actively sets the start.
  const [startTouched, setStartTouched] = useState<boolean>(isEdit);

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const mutation = isEdit ? updateEvent : createEvent;

  // Drop a stale submit error as soon as the user changes anything.
  const clearError = (): void => {
    if (mutation.isError) {
      mutation.reset();
    }
  };

  const onStartChange = (value: string): void => {
    clearError();
    setStartsAt(value);
    setStartTouched(true);
    // Each start change re-suggests start + 2h; the user may then adjust it.
    setEndsAt(addHours(value, DEFAULT_DURATION_HOURS));
  };

  // On Android, confirming the prefilled start fires no change/blur event.
  // Focusing the start (tapping to open the picker) is the reliable signal:
  // enable the end and fill it from the current start when still empty.
  const onStartFocus = (): void => {
    if (startsAt && !endsAt) {
      setStartTouched(true);
      setEndsAt(addHours(startsAt, DEFAULT_DURATION_HOURS));
    }
  };

  const onEndChange = (value: string): void => {
    clearError();
    setEndsAt(value);
  };

  const errorMessage = mutation.isError
    ? mutation.error instanceof ApiError && mutation.error.status === 409
      ? 'Цей час на площадці вже зайнятий. Оберіть інший час або площадку.'
      : 'Не вдалося зберегти подію (можливо, дата поза дозволеним діапазоном).'
    : null;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!startsAt || !endsAt) {
      return;
    }
    const body = {
      type,
      resourceId,
      capacity,
      title: event?.title ?? undefined,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    };
    if (event) {
      updateEvent.mutate({ id: event.id, body }, { onSuccess: onClose });
    } else {
      createEvent.mutate(body, { onSuccess: onClose });
    }
  };

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span className="field__label">Тип</span>
        <select
          value={type}
          onChange={(e) => {
            clearError();
            setType(e.target.value as EventType);
          }}
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
          onChange={(e) => {
            clearError();
            setResourceId(Number(e.target.value) as ResourceId);
          }}
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
          onChange={(e) => {
            clearError();
            setCapacity(Number(e.target.value));
          }}
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
          value={startsAt}
          onChange={(e) => onStartChange(e.target.value)}
          onFocus={onStartFocus}
        />
      </label>

      <label className="field">
        <span className="field__label">Кінець</span>
        <input
          type="datetime-local"
          value={endsAt}
          disabled={!startTouched}
          onChange={(e) => onEndChange(e.target.value)}
        />
      </label>

      {errorMessage && <p className="form__error">{errorMessage}</p>}

      <div className="form__actions">
        <Button variant="secondary" block onClick={onClose}>
          Скасувати
        </Button>
        <Button
          type="submit"
          block
          disabled={mutation.isPending || !startsAt || !endsAt}
        >
          Зберегти
        </Button>
      </div>
    </form>
  );
}
