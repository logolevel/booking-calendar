import { format, isSameDay } from 'date-fns';
import { uk } from 'date-fns/locale';
import type { HeaderProps } from 'react-big-calendar';

export function CalendarDayHeader({ date }: HeaderProps): JSX.Element {
  const isToday = isSameDay(date, new Date());
  return (
    <div className={`rbc-day-head${isToday ? ' is-today' : ''}`}>
      <span className="rbc-day-head__weekday">
        {format(date, 'EEEEEE', { locale: uk })}
      </span>
      <span className="rbc-day-head__date">{format(date, 'd')}</span>
    </div>
  );
}
