import { useState } from 'react';
import {
  SUBSCRIPTION_DEFAULT_MONTHS,
  SUBSCRIPTION_MAX_MONTHS,
  SUBSCRIPTION_MIN_MONTHS,
  SUBSCRIPTION_SEASON_MONTHS,
  type SubscriptionDto,
} from '@tg-calendar/shared-types';
import { Sheet } from '../../../shared/ui/Sheet';
import { Button } from '../../../shared/ui/Button';
import { PersonName } from '../../../shared/ui/PersonName';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { useUserSearch } from '../../participation/useParticipation';
import {
  useCancelSubscription,
  useCreateSubscription,
  useSubscriptions,
} from '../useSubscriptions';

interface Props {
  onClose: () => void;
}

const MONTH_OPTIONS = Array.from(
  { length: SUBSCRIPTION_MAX_MONTHS - SUBSCRIPTION_MIN_MONTHS + 1 },
  (_, i) => i + SUBSCRIPTION_MIN_MONTHS,
);

const dateFmt = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatRange(sub: SubscriptionDto): string {
  return `${dateFmt.format(new Date(sub.startsAt))} – ${dateFmt.format(
    new Date(sub.endsAt),
  )}`;
}

function monthLabel(m: number): string {
  return m === SUBSCRIPTION_SEASON_MONTHS
    ? `Сезон (${m} міс.)`
    : `${m} міс.`;
}

export function SubscriptionsSheet({ onClose }: Props): JSX.Element {
  const { data, isLoading, isError } = useSubscriptions(true);
  const create = useCreateSubscription();
  const cancel = useCancelSubscription();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [months, setMonths] = useState<number>(SUBSCRIPTION_DEFAULT_MONTHS);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const search = useUserSearch(selected ? '' : query);

  const askCancel = (sub: SubscriptionDto): void => {
    setConfirm({
      message: `Скасувати абонемент для ${sub.userName}?`,
      onConfirm: () => cancel.mutate(sub.id),
    });
  };

  const subscriptions = data?.subscriptions ?? [];
  const results = search.data ?? [];

  const submit = (): void => {
    if (!selected) {
      return;
    }
    create.mutate(
      { userId: selected.id, months, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setSelected(null);
          setQuery('');
          setNote('');
          setMonths(SUBSCRIPTION_DEFAULT_MONTHS);
        },
      },
    );
  };

  return (
    <Sheet title="Абонементи" onClose={onClose}>
      <div className="participants__add">
        {selected ? (
          <div className="subs__selected">
            <span>{selected.name}</span>
            <button
              type="button"
              className="participants__remove"
              aria-label="Скинути"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <input
              className="participants__search"
              placeholder="Кому видати (ім'я або @username)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query.trim().length >= 2 && (
              <ul className="participants__results">
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="participants__result"
                      onClick={() => {
                        setSelected({ id: u.id, name: u.name });
                        setQuery('');
                      }}
                    >
                      {u.name}
                      {u.username && (
                        <span className="participants__by"> @{u.username}</span>
                      )}
                    </button>
                  </li>
                ))}
                {!search.isLoading && results.length === 0 && (
                  <li className="participants__empty">Нічого не знайдено</li>
                )}
              </ul>
            )}
          </>
        )}

        <label className="field">
          <span className="field__label">Тривалість</span>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Нотатка (необов'язково)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Напр. оплата готівкою"
          />
        </label>

        {create.isError && (
          <p className="form__error">Не вдалося видати абонемент.</p>
        )}

        <Button block disabled={!selected || create.isPending} onClick={submit}>
          Видати абонемент
        </Button>
      </div>

      <p className="field__hint">
        Власник активного абонемента має доступ до прайм-тайму в повному вікні
        бронювання. Тижневий ліміт (2/тиждень, 1 зелений) діє для всіх.
      </p>

      {isLoading && <p className="state__text">Завантаження…</p>}
      {isError && <p className="form__error">Не вдалося завантажити список.</p>}

      {data && (
        <>
          <h3 className="subs__heading">Історія</h3>
          {subscriptions.length === 0 ? (
            <p className="state__text">Ще немає жодного абонемента.</p>
          ) : (
            <ul className="participants__list">
              {subscriptions.map((s) => (
                <li key={s.id} className="participants__item">
                  <span className="participants__name">
                    <PersonName
                      name={s.userName}
                      gender={s.gender}
                      isAdmin={s.isAdmin}
                      isUser
                      isRoot={s.isRoot}
                      isSubscriber={s.isSubscriber}
                    />
                    <span className="subs__meta">
                      {formatRange(s)} · {monthLabel(s.months)}
                      {s.note ? ` · ${s.note}` : ''}
                    </span>
                  </span>
                  <span className="subs__actions">
                    <span
                      className={`chip ${s.isActive ? 'chip--accent' : ''}`.trim()}
                    >
                      {s.isActive ? 'Активний' : 'Завершено'}
                    </span>
                    {s.isActive && (
                      <button
                        type="button"
                        className="participants__remove"
                        aria-label="Скасувати абонемент"
                        disabled={cancel.isPending}
                        onClick={() => askCancel(s)}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {cancel.isError && (
        <p className="form__error">Не вдалося скасувати абонемент.</p>
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => {
            confirm.onConfirm();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Sheet>
  );
}
