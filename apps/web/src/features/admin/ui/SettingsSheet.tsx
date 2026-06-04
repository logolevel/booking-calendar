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
  const [primeStart, setPrimeStart] = useState<string>('18:30');
  const [primeEnd, setPrimeEnd] = useState<string>('20:30');
  const [subPrimeStart, setSubPrimeStart] = useState<string>('16:30');
  const [subPrimeEnd, setSubPrimeEnd] = useState<string>('20:30');
  const [primeMemberOpenHour, setPrimeMemberOpenHour] = useState<number>(12);
  const [notify, setNotify] = useState<boolean>(true);

  // Seed the form once the current settings arrive.
  useEffect(() => {
    if (data) {
      setMaxDaysAhead(data.maxDaysAhead);
      setBookingOpenHour(data.bookingOpenHour);
      setPrimeStart(data.primeStart);
      setPrimeEnd(data.primeEnd);
      setSubPrimeStart(data.subPrimeStart);
      setSubPrimeEnd(data.subPrimeEnd);
      setPrimeMemberOpenHour(data.primeMemberOpenHour);
    }
  }, [data]);

  const primeInvalid = primeStart >= primeEnd;
  const subPrimeInvalid = subPrimeStart >= subPrimeEnd;
  // The quota window must sit inside the gated subscription-prime window.
  const rangeInvalid = primeStart < subPrimeStart || primeEnd > subPrimeEnd;
  const formInvalid = primeInvalid || subPrimeInvalid || rangeInvalid;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (formInvalid) {
      return;
    }
    update.mutate(
      {
        maxDaysAhead,
        bookingOpenHour,
        primeStart,
        primeEnd,
        subPrimeStart,
        subPrimeEnd,
        primeMemberOpenHour,
        notify,
      },
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

          <div className="field">
            <span className="field__label">Прайм-тайм</span>
            <div className="settings__range">
              <input
                type="time"
                step={1800}
                value={primeStart}
                onChange={(e) => setPrimeStart(e.target.value)}
              />
              <span className="settings__range-dash">–</span>
              <input
                type="time"
                step={1800}
                value={primeEnd}
                onChange={(e) => setPrimeEnd(e.target.value)}
              />
            </div>
          </div>

          <p className="field__hint">
            У прайм-тайм: не більше 2 записів на тиждень, із них не більше 1 на
            зелений майданчик (для всіх, завжди).
          </p>

          <div className="field">
            <span className="field__label">Прайм-абонемент тайм</span>
            <div className="settings__range">
              <input
                type="time"
                step={1800}
                value={subPrimeStart}
                onChange={(e) => setSubPrimeStart(e.target.value)}
              />
              <span className="settings__range-dash">–</span>
              <input
                type="time"
                step={1800}
                value={subPrimeEnd}
                onChange={(e) => setSubPrimeEnd(e.target.value)}
              />
            </div>
          </div>

          <p className="field__hint">
            Жовте вікно в календарі. Має містити прайм-тайм. Доступ у цьому вікні
            гейтиться: власники абонемента — одразу, звичайні учасники — лише з
            години нижче напередодні події.
          </p>

          <label className="field">
            <span className="field__label">
              Прайм-абонемент для учасників відкривається з
            </span>
            <select
              value={primeMemberOpenHour}
              onChange={(e) => setPrimeMemberOpenHour(Number(e.target.value))}
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>

          <p className="field__hint">
            Звичайні учасники можуть записатися чи стати в чергу у прайм-абонемент
            вікні лише з цієї години напередодні події. Власники абонемента — у
            повному вікні бронювання.
          </p>

          <label className="participants__checkbox field">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
            />
            Сповістити всіх учасників
          </label>

          {primeInvalid && (
            <p className="form__error">
              Початок прайм-тайму має бути раніше за кінець.
            </p>
          )}
          {subPrimeInvalid && (
            <p className="form__error">
              Початок прайм-абонемент тайму має бути раніше за кінець.
            </p>
          )}
          {!primeInvalid && !subPrimeInvalid && rangeInvalid && (
            <p className="form__error">
              Прайм-тайм має бути в межах прайм-абонемент тайму.
            </p>
          )}
          {update.isError && (
            <p className="form__error">Не вдалося зберегти налаштування.</p>
          )}

          <div className="form__actions">
            <Button variant="secondary" block onClick={onClose}>
              Скасувати
            </Button>
            <Button
              type="submit"
              block
              disabled={update.isPending || formInvalid}
            >
              Зберегти
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
