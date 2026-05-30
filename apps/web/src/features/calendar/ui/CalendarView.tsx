import { useMemo, useRef, useState, type TouchEvent } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
} from 'react-big-calendar';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  addDays,
  addWeeks,
  addMonths,
} from 'date-fns';
import { uk } from 'date-fns/locale';
import { ROLE, type Role } from '@tg-calendar/shared-types';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useEvents } from '../useEvents';
import { toRbcEvent, type RbcEvent } from '../model/rbcEvent';
import { Sheet } from '../../../shared/ui/Sheet';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarDayHeader } from './CalendarDayHeader';
import { CreateEventForm } from './CreateEventForm';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { uk },
});

const RESOURCE_COLORS: Record<number, string> = {
  1: 'var(--resource-1)',
  2: 'var(--resource-2)',
};

const calendarComponents = {
  toolbar: CalendarToolbar,
  week: { header: CalendarDayHeader },
  day: { header: CalendarDayHeader },
};

const SWIPE_MIN_DISTANCE = 60;

function shiftDate(date: Date, view: View, direction: 1 | -1): Date {
  switch (view) {
    case Views.DAY:
      return addDays(date, direction);
    case Views.MONTH:
      return addMonths(date, direction);
    case Views.AGENDA:
      return addDays(date, direction * 7);
    default:
      return addWeeks(date, direction);
  }
}

interface Props {
  role: Role;
}

export function CalendarView({ role }: Props): JSX.Element {
  const { data, isLoading, isError } = useEvents();
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState<boolean>(false);

  const canCreate = role === ROLE.ADMIN || role === ROLE.MEMBER;

  const events = useMemo<RbcEvent[]>(
    () => (data ?? []).map(toRbcEvent),
    [data],
  );

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: TouchEvent): void => {
    if (showForm) {
      return;
    }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: TouchEvent): void => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || showForm) {
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Horizontal swipe only: left → next period, right → previous.
    if (Math.abs(dx) > SWIPE_MIN_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setDate((d) => shiftDate(d, view, dx < 0 ? 1 : -1));
    }
  };

  return (
    <div
      className="calendar-wrap"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {isError && <p className="form__error">Не вдалося завантажити події.</p>}

      <Calendar<RbcEvent>
        localizer={localizer}
        culture="uk"
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        views={[Views.DAY, Views.WEEK, Views.AGENDA, Views.MONTH]}
        components={calendarComponents}
        min={new Date(1970, 0, 1, 8, 0, 0)}
        max={new Date(1970, 0, 1, 23, 0, 0)}
        popup
        eventPropGetter={(event) => ({
          style: {
            backgroundColor: RESOURCE_COLORS[event.resourceId] ?? 'var(--accent)',
          },
        })}
      />

      {isLoading && <p className="state__text">Завантаження подій…</p>}

      {canCreate && (
        <button
          type="button"
          className="fab"
          aria-label="Створити подію"
          onClick={() => setShowForm(true)}
        >
          +
        </button>
      )}

      {showForm && canCreate && (
        <Sheet title="Нова подія" onClose={() => setShowForm(false)}>
          <CreateEventForm onClose={() => setShowForm(false)} />
        </Sheet>
      )}
    </div>
  );
}
