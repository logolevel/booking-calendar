import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { StatsCategory, StatsUserRow } from '@tg-calendar/shared-types';
import { Sheet } from '../../../shared/ui/Sheet';
import { useStats } from '../useStats';

interface Props {
  onClose: () => void;
}

type SortKey = 'name' | 'total' | 'regular' | 'group' | 'children';

const CATEGORY_LABELS: Record<StatsCategory, string> = {
  all: 'Всі',
  regular: 'Звичайні',
  group: 'Група',
  children: 'Діти',
  no_sub: 'Без абонемента',
};

const LOCAL_PATTERN = 'yyyy-MM-dd';

const UK_MONTHS = [
  'Січень','Лютий','Березень','Квітень','Травень','Червень',
  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень',
];

function ukrainianMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${UK_MONTHS[m - 1] ?? ''} ${y}`;
}

function monthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const ym = format(d, 'yyyy-MM');
    opts.push({ value: ym, label: ukrainianMonth(ym) });
  }
  return opts;
}

function fromMonth(ym: string): string {
  const d = new Date(`${ym}-01`);
  return format(startOfMonth(d), LOCAL_PATTERN);
}

function toMonth(ym: string): string {
  const d = new Date(`${ym}-01`);
  return format(endOfMonth(d), LOCAL_PATTERN);
}

function getDaysInMonth(ym: string): string[] {
  const d = new Date(`${ym}-01`);
  const end = endOfMonth(d);
  const days: string[] = [];
  const cur = new Date(d);
  while (cur <= end) {
    days.push(format(cur, LOCAL_PATTERN));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function visitsForDay(row: StatsUserRow, day: string): number {
  const entry = row.days.find((d) => d.date === day);
  return entry?.visits ?? 0;
}

function filterRows(rows: StatsUserRow[], category: StatsCategory): StatsUserRow[] {
  switch (category) {
    case 'regular':
      return rows.filter((r) => r.regularVisits > 0);
    case 'group':
      return rows.filter((r) => r.groupVisits > 0);
    case 'children':
      return rows.filter((r) => r.childrenVisits > 0);
    case 'no_sub':
      return rows.filter((r) => !r.hasSubscription && r.regularVisits > 0);
    default:
      return rows;
  }
}

function sortRows(rows: StatsUserRow[], key: SortKey, asc: boolean): StatsUserRow[] {
  return [...rows].sort((a, b) => {
    let diff = 0;
    switch (key) {
      case 'name':
        diff = a.name.localeCompare(b.name, 'uk');
        break;
      case 'total':
        diff = a.totalVisits - b.totalVisits;
        break;
      case 'regular':
        diff = a.regularVisits - b.regularVisits;
        break;
      case 'group':
        diff = a.groupVisits - b.groupVisits;
        break;
      case 'children':
        diff = a.childrenVisits - b.childrenVisits;
        break;
    }
    return asc ? diff : -diff;
  });
}

const dateFmtShort = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: 'numeric',
  month: 'short',
});

function fmtDay(dateStr: string): string {
  return dateFmtShort.format(new Date(dateStr));
}

export function StatsSheet({ onClose }: Props): JSX.Element {
  const now = new Date();
  const currentYm = format(now, 'yyyy-MM');

  const [selectedMonth, setSelectedMonth] = useState<string>(currentYm);
  const [category, setCategory] = useState<StatsCategory>('all');
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const from = fromMonth(selectedMonth);
  const to = toMonth(selectedMonth);

  const { data, isLoading, isError } = useStats(from, to);

  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth]);

  const rows = useMemo(() => {
    if (!data) return [];
    const filtered = filterRows(data.rows, category);
    return sortRows(filtered, sortKey, sortAsc);
  }, [data, category, sortKey, sortAsc]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.total += r.totalVisits;
        acc.regular += r.regularVisits;
        acc.group += r.groupVisits;
        acc.children += r.childrenVisits;
        return acc;
      },
      { total: 0, regular: 0, group: 0, children: 0 },
    );
  }, [rows]);

  const months = useMemo(() => monthOptions(), []);

  function handleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function sortIcon(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortAsc ? ' ↑' : ' ↓';
  }

  function rowKey(r: StatsUserRow): string {
    if (r.userId != null) return `u:${r.userId}`;
    if (r.guestId != null) return `g:${r.guestId}`;
    return `n:${r.name}`;
  }

  return (
    <Sheet title="Статистика" onClose={onClose}>
      <div className="stats">
        {/* ── Filters ── */}
        <div className="stats__filters">
          <label className="stats__filter-label">
            <span>Місяць</span>
            <select
              className="stats__select"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setExpandedRow(null);
              }}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {ukrainianMonth(m.value)}
                </option>
              ))}
            </select>
          </label>

          <label className="stats__filter-label">
            <span>Категорія</span>
            <select
              className="stats__select"
              value={category}
              onChange={(e) => setCategory(e.target.value as StatsCategory)}
            >
              {(Object.keys(CATEGORY_LABELS) as StatsCategory[]).map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ── Period label ── */}
        <div className="stats__period">
          {ukrainianMonth(selectedMonth)}
        </div>

        {/* ── State ── */}
        {isLoading && <p className="state__text">Завантаження…</p>}
        {isError && (
          <p className="stats__error">Не вдалося завантажити статистику.</p>
        )}

        {!isLoading && !isError && data && (
          <>
            {/* ── Summary cards ── */}
            <div className="stats__cards">
              <div className="stats__card">
                <div className="stats__card-value">{rows.length}</div>
                <div className="stats__card-label">Учасників</div>
              </div>
              <div className="stats__card">
                <div className="stats__card-value">{totals.total}</div>
                <div className="stats__card-label">Всього відвідувань</div>
              </div>
              <div className="stats__card stats__card--regular">
                <div className="stats__card-value">{totals.regular}</div>
                <div className="stats__card-label">Звичайні</div>
              </div>
              <div className="stats__card stats__card--group">
                <div className="stats__card-value">{totals.group}</div>
                <div className="stats__card-label">Група</div>
              </div>
              <div className="stats__card stats__card--children">
                <div className="stats__card-value">{totals.children}</div>
                <div className="stats__card-label">Діти 18+</div>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="state__text">Немає даних за цей період.</p>
            ) : (
              <>
                {/* ── Sort controls ── */}
                <div className="stats__sort-bar">
                  <span className="stats__sort-label">Сортування:</span>
                  {(
                    [
                      ['name', "Ім'я"],
                      ['total', 'Всього'],
                      ['regular', 'Звичайні'],
                      ['group', 'Група'],
                      ['children', 'Діти'],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`stats__sort-btn${sortKey === key ? ' stats__sort-btn--active' : ''}`}
                      onClick={() => handleSort(key)}
                    >
                      {label}{sortIcon(key)}
                    </button>
                  ))}
                </div>

                {/* ── Table ── */}
                <div className="stats__list">
                  {rows.map((row) => {
                    const key = rowKey(row);
                    const isExpanded = expandedRow === key;
                    return (
                      <div key={key} className="stats__row">
                        <button
                          type="button"
                          className="stats__row-head"
                          onClick={() =>
                            setExpandedRow(isExpanded ? null : key)
                          }
                        >
                          <div className="stats__row-name">
                            {row.name}
                            {row.hasSubscription && (
                              <span className="stats__badge stats__badge--sub">
                                ⭐
                              </span>
                            )}
                            {!row.hasSubscription && row.userId != null && (
                              <span className="stats__badge stats__badge--nosub">
                                без аб.
                              </span>
                            )}
                          </div>
                          <div className="stats__row-counts">
                            {row.regularVisits > 0 && (
                              <span className="stats__pill stats__pill--regular">
                                {row.regularVisits}
                              </span>
                            )}
                            {row.groupVisits > 0 && (
                              <span className="stats__pill stats__pill--group">
                                Гр {row.groupVisits}
                              </span>
                            )}
                            {row.childrenVisits > 0 && (
                              <span className="stats__pill stats__pill--children">
                                Д {row.childrenVisits}
                              </span>
                            )}
                            <span className="stats__total">
                              {row.totalVisits}
                            </span>
                            <span className="stats__chevron">
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="stats__days">
                            <div className="stats__days-grid">
                              {daysInMonth.map((day) => {
                                const v = visitsForDay(row, day);
                                return (
                                  <div
                                    key={day}
                                    className={`stats__day${v > 0 ? ' stats__day--active' : ''}`}
                                    title={fmtDay(day)}
                                  >
                                    <span className="stats__day-num">
                                      {parseInt(day.slice(8), 10)}
                                    </span>
                                    {v > 0 && (
                                      <span className="stats__day-dot" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="stats__days-list">
                              {row.days.map((d) => (
                                <div key={d.date} className="stats__day-entry">
                                  <span className="stats__day-date">
                                    {fmtDay(d.date)}
                                  </span>
                                  <span className="stats__day-visits">
                                    {d.visits} відв.
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
