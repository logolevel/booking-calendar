import { useEffect, useState, type FormEvent } from 'react';
import { Sheet } from '../../../shared/ui/Sheet';
import { Button } from '../../../shared/ui/Button';
import { useAdminSettings, useUpdateAdminSettings } from '../useAdminSettings';

interface Props {
  onClose: () => void;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);

// Days 1..30 in the dropdown; the current value is added if it falls outside.
function dayOptions(current: number): number[] {
  const base = Array.from({ length: 30 }, (_, i) => i + 1);
  if (!base.includes(current)) {
    base.push(current);
    base.sort((a, b) => a - b);
  }
  return base;
}

export function SettingsSheet({ onClose }: Props): JSX.Element {
  const { data, isLoading, isError } = useAdminSettings(true);
  const update = useUpdateAdminSettings();

  const [maxDaysAhead, setMaxDaysAhead] = useState<number>(7);
  const [bookingOpenHour, setBookingOpenHour] = useState<number>(10);
  const [notify, setNotify] = useState<boolean>(true);

  // Seed the form once the current settings arrive.
  useEffect(() => {
    if (data) {
      setMaxDaysAhead(data.maxDaysAhead);
      setBookingOpenHour(data.bookingOpenHour);
    }
  }, [data]);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    update.mutate(
      { maxDaysAhead, bookingOpenHour, notify },
      { onSuccess: onClose },
    );
  };

  return (
    <Sheet title="Налаштування" onClose={onClose}>
      {isLoading && <p className="state__text">Завантаження…</p>}
      {isError && (
        <p className="form__error">Не вдалося завантажити налаштування.</p>
      )}

      {data && (
        <form onSubmit={submit}>
          <label className="field">
            <span className="field__label">Період запису (днів наперед)</span>
            <select
              value={maxDaysAhead}
              onChange={(e) => setMaxDaysAhead(Number(e.target.value))}
            >
              {dayOptions(data.maxDaysAhead).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Час відкриття запису</span>
            <select
              value={bookingOpenHour}
              onChange={(e) => setBookingOpenHour(Number(e.target.value))}
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>

          <label className="participants__checkbox field">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
            />
            Сповістити всіх учасників
          </label>

          {update.isError && (
            <p className="form__error">Не вдалося зберегти налаштування.</p>
          )}

          <div className="form__actions">
            <Button variant="secondary" block onClick={onClose}>
              Скасувати
            </Button>
            <Button type="submit" block disabled={update.isPending}>
              Зберегти
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
