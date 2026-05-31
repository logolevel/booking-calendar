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
  isAdmin: boolean;
  onClose: () => void;
}

export function EventForm({ event, isAdmin, onClose }: Props): JSX.Element {
  const isEdit = Boolean(event);
  const [type, setType] = useState<EventType>(event?.type ?? EVENT_TYPE.MIXED);
  const [resourceId, setResourceId] = useState<ResourceId>(
    event?.resourceId ?? RESOURCE_IDS[0],
  );
  const [capacity, setCapacity] = useState<number>(
    event?.capacity ?? DEFAULT_CAPACITY,
  );
  const [organizerName, setOrganizerName] = useState<string>(
    event?.organizerName ?? '',
  );
  const [organizerPhone, setOrganizerPhone] = useState<string>(
    event?.organizerPhone ?? '',
  );
  // Admin only: create an event without joining it (empty event for others).
  const [skipSelf, setSkipSelf] = useState<boolean>(false);

  const isGroup = type === EVENT_TYPE.GROUP;
  // A non-admin author may edit only the capacity; everything else is locked.
  const limitOnly = isEdit && !isAdmin;
  // An author may only raise the limit, never below who is already in.
  const minCapacity = limitOnly
    ? Math.max(MIN_CAPACITY, event?.participantCount ?? MIN_CAPACITY)
    : MIN_CAPACITY;
  const capacityOptions = CAPACITY_OPTIONS.filter((n) => n >= minCapacity);
  // The group type is admin-only, but keep it available when editing one.
  const typeOptions = Object.values(EVENT_TYPE).filter(
    (t) => t !== EVENT_TYPE.GROUP || isAdmin || event?.type === EVENT_TYPE.GROUP,
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

  const canSubmit =
    Boolean(startsAt) &&
    Boolean(endsAt) &&
    (!isGroup || organizerName.trim().length > 0);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    const body = {
      type,
      resourceId,
      // Group bookings have no sign-up list; capacity is irrelevant.
      capacity: isGroup ? MIN_CAPACITY : capacity,
      title: event?.title ?? undefined,
      organizerName: isGroup ? organizerName.trim() : undefined,
      organizerPhone:
        isGroup && organizerPhone.trim() ? organizerPhone.trim() : undefined,
      skipSelf: isAdmin && !isGroup && !isEdit ? skipSelf : undefined,
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
          disabled={limitOnly}
          onChange={(e) => {
            clearError();
            setType(e.target.value as EventType);
          }}
        >
          {typeOptions.map((t) => (
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
          disabled={limitOnly}
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

      {isGroup ? (
        <>
          <label className="field">
            <span className="field__label">Ім'я організатора</span>
            <input
              type="text"
              value={organizerName}
              onChange={(e) => {
                clearError();
                setOrganizerName(e.target.value);
              }}
            />
          </label>

          <label className="field">
            <span className="field__label">Номер телефону (необов'язково)</span>
            <input
              type="tel"
              inputMode="tel"
              value={organizerPhone}
              onChange={(e) => {
                clearError();
                setOrganizerPhone(e.target.value);
              }}
            />
          </label>
        </>
      ) : (
        <label className="field">
          <span className="field__label">Ліміт учасників</span>
          <select
            value={capacity}
            onChange={(e) => {
              clearError();
              setCapacity(Number(e.target.value));
            }}
          >
            {capacityOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span className="field__label">Початок</span>
        <input
          type="datetime-local"
          value={startsAt}
          disabled={limitOnly}
          onChange={(e) => onStartChange(e.target.value)}
          onFocus={onStartFocus}
        />
      </label>

      <label className="field">
        <span className="field__label">Кінець</span>
        <input
          type="datetime-local"
          value={endsAt}
          disabled={limitOnly || !startTouched}
          onChange={(e) => onEndChange(e.target.value)}
        />
      </label>

      {isAdmin && !isGroup && !isEdit && (
        <label className="participants__checkbox field">
          <input
            type="checkbox"
            checked={skipSelf}
            onChange={(e) => setSkipSelf(e.target.checked)}
          />
          Не записувати мене
        </label>
      )}

      {errorMessage && <p className="form__error">{errorMessage}</p>}

      <div className="form__actions">
        <Button variant="secondary" block onClick={onClose}>
          Скасувати
        </Button>
        <Button type="submit" block disabled={mutation.isPending || !canSubmit}>
          Зберегти
        </Button>
      </div>
    </form>
  );
}
