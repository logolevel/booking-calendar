import { useMemo, useState } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
} from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
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

  return (
    <div className="calendar-wrap">
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
