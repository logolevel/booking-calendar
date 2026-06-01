import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Button } from '../../../shared/ui/Button';
import {
  addStep,
  clampEnd,
  dayEndOf,
  dayStartOf,
  STEP_MIN,
} from '../model/slotTime';

interface Props {
  start: Date;
  end: Date;
  onChange: (start: Date, end: Date) => void;
  onCreate: () => void;
  onCancel: () => void;
}

function fmtTime(d: Date): string {
  return format(d, 'HH:mm');
}

export function SlotPreview({
  start,
  end,
  onChange,
  onCreate,
  onCancel,
}: Props): JSX.Element {
  const dayStart = dayStartOf(start);
  const dayEnd = dayEndOf(start);

  // Each handle moves in 30-minute steps, like dragging in Google Calendar.
  const moveStart = (steps: number): void => {
    let next = addStep(start, steps);
    if (next < dayStart) next = dayStart;
    // Keep at least one step before the end.
    const maxStart = addStep(end, -1);
    if (next > maxStart) next = maxStart;
    onChange(next, end);
  };

  const moveEnd = (steps: number): void => {
    const next = clampEnd(start, addStep(end, steps));
    onChange(start, next);
  };

  const startAtFloor = start <= dayStart;
  const startAtCeil = addStep(start, 1) >= end;
  const endAtFloor = addStep(end, -1) <= start;
  const endAtCeil = end >= dayEnd;

  return (
    <div className="slot-preview">
      <p className="slot-preview__date">
        {format(start, 'EEEE, d MMM', { locale: uk })}
      </p>

      <div className="slot-preview__row">
        <span className="slot-preview__label">Початок</span>
        <div className="slot-preview__stepper">
          <button
            type="button"
            aria-label={`Раніше на ${STEP_MIN} хв`}
            disabled={startAtFloor}
            onClick={() => moveStart(-1)}
          >
            −
          </button>
          <span className="slot-preview__time">{fmtTime(start)}</span>
          <button
            type="button"
            aria-label={`Пізніше на ${STEP_MIN} хв`}
            disabled={startAtCeil}
            onClick={() => moveStart(1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="slot-preview__row">
        <span className="slot-preview__label">Кінець</span>
        <div className="slot-preview__stepper">
          <button
            type="button"
            aria-label={`Раніше на ${STEP_MIN} хв`}
            disabled={endAtFloor}
            onClick={() => moveEnd(-1)}
          >
            −
          </button>
          <span className="slot-preview__time">{fmtTime(end)}</span>
          <button
            type="button"
            aria-label={`Пізніше на ${STEP_MIN} хв`}
            disabled={endAtCeil}
            onClick={() => moveEnd(1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="form__actions">
        <Button variant="secondary" block onClick={onCancel}>
          Скасувати
        </Button>
        <Button block onClick={onCreate}>
          Створити подію
        </Button>
      </div>
    </div>
  );
}
