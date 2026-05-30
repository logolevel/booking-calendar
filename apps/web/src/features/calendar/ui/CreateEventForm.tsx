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
import { Button } from '../../../shared/ui/Button';

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
        <input
          type="number"
          min={MIN_CAPACITY}
          max={MAX_CAPACITY}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
      </label>

      <label className="field">
        <span className="field__label">Початок</span>
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Кінець</span>
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
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
