import {
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type TouchEvent,
} from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
  type SlotInfo,
} from 'react-big-calendar';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfDay,
  addDays,
  addWeeks,
  addMonths,
  isBefore,
  isAfter,
} from 'date-fns';
import { uk } from 'date-fns/locale';
import {
  EVENT_TYPE,
  ROLE,
  type EventDto,
  type Role,
} from '@tg-calendar/shared-types';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useEvents } from '../useEvents';
import { toRbcEvent, draftRbcEvent, type RbcEvent } from '../model/rbcEvent';
import {
  addStep,
  clampEnd,
  clampStart,
  snap30,
  DEFAULT_DURATION_MIN,
  STEP_MIN,
} from '../model/slotTime';
import { Sheet } from '../../../shared/ui/Sheet';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarDayHeader } from './CalendarDayHeader';
import { EventForm } from './EventForm';
import { SlotPreview } from './SlotPreview';
import { ThreeDayView } from './ThreeDayView';
import { ParticipantsPanel } from '../../participation/ui/ParticipantsPanel';

const DEFAULT_DURATION_STEPS = DEFAULT_DURATION_MIN / STEP_MIN;

const THREE_DAY_VIEW = 'three_day';

// Phones get the compact 3-day view by default; wider screens get the week.
const MOBILE_MAX_WIDTH = 768;

function getDefaultView(): View {
  const isMobile =
    typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH;
  return (isMobile ? THREE_DAY_VIEW : Views.WEEK) as View;
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { uk },
});

// Light shade = free space, dark shade = taken; fills bottom-up like a glass.
const RESOURCE_FILL: Record<number, { light: string; dark: string }> = {
  1: { light: '#7fd29c', dark: '#1c7a42' },
  2: { light: '#f0938e', dark: '#bf372d' },
};

function eventFillStyle(event: RbcEvent): { background: string } {
  const colors = RESOURCE_FILL[event.resourceId] ?? {
    light: 'var(--accent)',
    dark: 'var(--accent)',
  };
  const { capacity, participantCount, type } = event.raw;
  const pct =
    type === EVENT_TYPE.GROUP
      ? 100
      : capacity > 0
        ? Math.min(participantCount / capacity, 1) * 100
        : 0;
  return {
    background: `linear-gradient(to top, ${colors.dark} 0%, ${colors.dark} ${pct}%, ${colors.light} ${pct}%, ${colors.light} 100%)`,
  };
}

type CalendarProps = ComponentProps<typeof Calendar<RbcEvent>>;

// Custom keys (three_day) require loosening the strict view typings.
const calendarComponents = {
  toolbar: CalendarToolbar,
  week: { header: CalendarDayHeader },
  day: { header: CalendarDayHeader },
  [THREE_DAY_VIEW]: { header: CalendarDayHeader },
} as unknown as CalendarProps['components'];

// Tab order; "Список" (agenda) sits last, after "Місяць".
const calendarViews = {
  day: true,
  [THREE_DAY_VIEW]: ThreeDayView,
  week: true,
  month: true,
  agenda: true,
} as unknown as CalendarProps['views'];

const SWIPE_MIN_DISTANCE = 60;

function shiftDate(date: Date, view: string, direction: 1 | -1): Date {
  switch (view) {
    case Views.DAY:
      return addDays(date, direction);
    case THREE_DAY_VIEW:
      return addDays(date, direction * 3);
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
  maxDaysAhead: number;
}

export function CalendarView({ role, maxDaysAhead }: Props): JSX.Element {
  const { data, isLoading, isError } = useEvents();
  const [view, setView] = useState<View>(getDefaultView);
  const [date, setDate] = useState<Date>(new Date());
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [activeEvent, setActiveEvent] = useState<EventDto | null>(null);
  const [mode, setMode] = useState<'details' | 'edit' | 'create' | 'slot'>(
    'create',
  );
  const [draft, setDraft] = useState<{ start: Date; end: Date } | null>(null);

  const canCreate = role === ROLE.ADMIN || role === ROLE.MEMBER;
  const isAdmin = role === ROLE.ADMIN;

  // Regular users can only book within [today, today + maxDaysAhead].
  const dayPropGetter = (day: Date): { className?: string } => {
    if (isAdmin) {
      return {};
    }
    const today = startOfDay(new Date());
    const maxDate = startOfDay(addDays(today, maxDaysAhead));
    if (isBefore(day, today) || isAfter(startOfDay(day), maxDate)) {
      return { className: 'rbc-day-off' };
    }
    return {};
  };

  const openCreate = (): void => {
    setActiveEvent(null);
    setDraft(null);
    setMode('create');
    setFormOpen(true);
  };

  const openDetails = (event: RbcEvent): void => {
    // Tapping the transient draft block should not open a roster.
    if (event.isDraft) {
      return;
    }
    setActiveEvent(event.raw);
    setMode('details');
    setFormOpen(true);
  };

  // Tap (or drag) on an empty slot to start creating an event there.
  const onSelectSlot = (slot: SlotInfo): void => {
    if (!canCreate || view === Views.MONTH || view === Views.AGENDA) {
      return;
    }
    const start = clampStart(snap30(slot.start));
    let end: Date;
    if (slot.action === 'select') {
      end = snap30(slot.end);
      if (end <= start) {
        end = addStep(start, 1);
      }
    } else {
      end = addStep(start, DEFAULT_DURATION_STEPS);
    }
    setDraft({ start, end: clampEnd(start, end) });
    setActiveEvent(null);
    setMode('slot');
    setFormOpen(true);
  };

  const closeForm = (): void => {
    setFormOpen(false);
    setActiveEvent(null);
    setDraft(null);
    setMode('create');
  };

  const sheetTitle =
    mode === 'details'
      ? 'Подія'
      : mode === 'slot'
        ? 'Новий запис'
        : mode === 'edit'
          ? 'Редагувати подію'
          : 'Нова подія';

  const events = useMemo<RbcEvent[]>(() => {
    const base = (data ?? []).map(toRbcEvent);
    if (draft && formOpen) {
      base.push(draftRbcEvent(draft.start, draft.end));
    }
    return base;
  }, [data, draft, formOpen]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: TouchEvent): void => {
    if (formOpen) {
      return;
    }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: TouchEvent): void => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || formOpen) {
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
        onSelectEvent={openDetails}
        selectable={canCreate}
        onSelectSlot={onSelectSlot}
        longPressThreshold={250}
        views={calendarViews}
        components={calendarComponents}
        dayPropGetter={dayPropGetter}
        min={new Date(1970, 0, 1, 8, 0, 0)}
        max={new Date(1970, 0, 1, 23, 0, 0)}
        popup
        eventPropGetter={(event) =>
          event.isDraft
            ? { className: 'rbc-event--draft' }
            : { style: eventFillStyle(event) }
        }
      />

      {isLoading && <p className="state__text">Завантаження подій…</p>}

      {canCreate && (
        <button
          type="button"
          className="fab"
          aria-label="Створити подію"
          onClick={openCreate}
        >
          +
        </button>
      )}

      {formOpen && (
        <Sheet title={sheetTitle} onClose={closeForm}>
          {mode === 'details' && activeEvent ? (
            <ParticipantsPanel
              event={activeEvent}
              onEdit={() => setMode('edit')}
              onClose={closeForm}
            />
          ) : mode === 'slot' && draft ? (
            <SlotPreview
              start={draft.start}
              end={draft.end}
              onChange={(start, end) => setDraft({ start, end })}
              onCreate={() => setMode('create')}
              onCancel={closeForm}
            />
          ) : (
            <EventForm
              event={activeEvent ?? undefined}
              isAdmin={isAdmin}
              initialStart={draft ? draft.start.toISOString() : undefined}
              initialEnd={draft ? draft.end.toISOString() : undefined}
              onClose={closeForm}
            />
          )}
        </Sheet>
      )}
    </div>
  );
}
