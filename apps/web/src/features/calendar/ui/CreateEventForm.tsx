import { useState, type FormEvent } from 'react';
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

const EVENT_TYPES = Object.values(EVENT_TYPE);

interface Props {
  onClose: () => void;
}

export function CreateEventForm({ onClose }: Props): JSX.Element {
  const [type, setType] = useState<EventType>(EVENT_TYPE.MIXED);
  const [resourceId, setResourceId] = useState<ResourceId>(RESOURCE_IDS[0]);
  const [capacity, setCapacity] = useState<number>(DEFAULT_CAPACITY);
  const [startsAt, setStartsAt] = useState<string>('');
  const [endsAt, setEndsAt] = useState<string>('');
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

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 12,
  };

  return (
    <form onSubmit={submit} style={{ padding: 16 }}>
      <label style={fieldStyle}>
        Тип
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

      <label style={fieldStyle}>
        Площадка
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

      <label style={fieldStyle}>
        Ліміт учасників
        <input
          type="number"
          min={MIN_CAPACITY}
          max={MAX_CAPACITY}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
      </label>

      <label style={fieldStyle}>
        Початок
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
      </label>

      <label style={fieldStyle}>
        Кінець
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </label>

      {createEvent.isError && (
        <p style={{ color: 'crimson' }}>
          Не вдалося створити подію (можливо, дата поза дозволеним діапазоном).
        </p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={createEvent.isPending}>
          Зберегти
        </button>
        <button type="button" onClick={onClose}>
          Скасувати
        </button>
      </div>
    </form>
  );
}
