import type { ToolbarProps, View } from 'react-big-calendar';
import type { RbcEvent } from '../model/rbcEvent';

const VIEW_LABELS: Record<string, string> = {
  day: 'День',
  week: 'Тиждень',
  work_week: 'Робочий тиждень',
  month: 'Місяць',
  agenda: 'Список',
};

export function CalendarToolbar({
  label,
  view,
  views,
  onView,
  onNavigate,
}: ToolbarProps<RbcEvent>): JSX.Element {
  const viewList = (
    Array.isArray(views) ? views : Object.keys(views)
  ) as View[];

  return (
    <div className="cal-toolbar">
      <div className="cal-toolbar__top">
        <div className="cal-toolbar__nav segmented" style={{ gap: 4 }}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Назад"
            onClick={() => onNavigate('PREV')}
          >
            ‹
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => onNavigate('TODAY')}
          >
            Сьогодні
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Вперед"
            onClick={() => onNavigate('NEXT')}
          >
            ›
          </button>
        </div>
        <span className="cal-toolbar__label">{label}</span>
      </div>

      <div className="cal-toolbar__views">
        <div className="segmented">
          {viewList.map((v) => (
            <button
              key={v}
              type="button"
              className={`segmented__item${v === view ? ' is-active' : ''}`}
              onClick={() => onView(v)}
            >
              {VIEW_LABELS[v] ?? v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
