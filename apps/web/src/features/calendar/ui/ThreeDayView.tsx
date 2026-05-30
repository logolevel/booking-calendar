import { Navigate, type NavigateAction } from 'react-big-calendar';
// TimeGrid is an internal building block used to compose custom multi-day views.
import TimeGrid from 'react-big-calendar/lib/TimeGrid';
import { addDays, format, startOfDay } from 'date-fns';
import { uk } from 'date-fns/locale';

const LENGTH = 3;

function range(date: Date): Date[] {
  const start = startOfDay(date);
  return Array.from({ length: LENGTH }, (_, i) => addDays(start, i));
}

interface ThreeDayProps extends Record<string, unknown> {
  date: Date;
}

function ThreeDayViewBase({ date, ...props }: ThreeDayProps): JSX.Element {
  return <TimeGrid {...props} range={range(date)} eventOffset={15} />;
}

// react-big-calendar reads range/navigate/title statics from a custom view.
export const ThreeDayView = Object.assign(ThreeDayViewBase, {
  range,
  navigate(date: Date, action: NavigateAction): Date {
    switch (action) {
      case Navigate.PREVIOUS:
        return addDays(date, -LENGTH);
      case Navigate.NEXT:
        return addDays(date, LENGTH);
      default:
        return date;
    }
  },
  title(date: Date): string {
    const start = startOfDay(date);
    const end = addDays(start, LENGTH - 1);
    return `${format(start, 'd MMM', { locale: uk })} – ${format(end, 'd MMM', {
      locale: uk,
    })}`;
  },
});
