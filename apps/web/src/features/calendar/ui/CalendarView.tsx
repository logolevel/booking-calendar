import { useMemo, useState } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
} from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { uk } from 'date-fns/locale';
import { ROLE, type EventDto, type Role } from '@tg-calendar/shared-types';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useEvents } from '../useEvents';
import { eventTypeLabel } from '../eventLabels';
import { CreateEventForm } from './CreateEventForm';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { uk },
});

interface RbcEvent {
  title: string;
  start: Date;
  end: Date;
  resourceId: number;
}

function toRbcEvent(event: EventDto): RbcEvent {
  return {
    title: event.title ?? eventTypeLabel(event.type),
    start: new Date(event.startsAt),
    end: new Date(event.endsAt),
    resourceId: event.resourceId,
  };
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

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Календар</h2>
        {canCreate && (
          <button type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Закрити' : '+ Подія'}
          </button>
        )}
      </div>

      {showForm && canCreate && (
        <CreateEventForm onClose={() => setShowForm(false)} />
      )}
      {isError && <p>Не вдалося завантажити події.</p>}

      <div style={{ height: '70vh' }}>
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
          min={new Date(1970, 0, 1, 8, 0, 0)}
          max={new Date(1970, 0, 1, 23, 0, 0)}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: event.resourceId === 1 ? '#2e7d32' : '#c62828',
            },
          })}
        />
      </div>
      {isLoading && <p>Завантаження подій…</p>}
    </div>
  );
}
