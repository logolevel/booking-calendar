import { useState } from 'react';
import type { TrainerUserDto } from '@tg-calendar/shared-types';
import { Sheet } from '../../../shared/ui/Sheet';
import { PersonName } from '../../../shared/ui/PersonName';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { useUserSearch } from '../../participation/useParticipation';
import { useTrainers, useGrantTrainer, useRevokeTrainer } from '../useTrainers';

interface Props {
  onClose: () => void;
}

export function TrainersSheet({ onClose }: Props): JSX.Element {
  const { data, isLoading, isError } = useTrainers(true);
  const grant = useGrantTrainer();
  const revoke = useRevokeTrainer();
  const [query, setQuery] = useState('');
  const search = useUserSearch(query);
  const [confirm, setConfirm] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const trainers = data?.trainers ?? [];
  const trainerIds = new Set(trainers.map((t) => t.userId));
  const results = (search.data ?? []).filter((u) => !trainerIds.has(u.id));

  const askRevoke = (t: TrainerUserDto): void => {
    setConfirm({
      message: `Зняти права тренера з ${t.name}?`,
      onConfirm: () => revoke.mutate(t.userId),
    });
  };

  return (
    <Sheet title="Тренери" onClose={onClose}>
      {isLoading && <p className="state__text">Завантаження…</p>}
      {isError && <p className="form__error">Не вдалося завантажити список.</p>}

      {data && (
        <>
          <ul className="participants__list">
            {trainers.map((t) => (
              <li key={t.userId} className="participants__item">
                <span className="participants__name">
                  <PersonName
                    name={t.name}
                    gender={t.gender}
                    isAdmin={false}
                    isUser
                    isTrainer
                  />
                  {t.isSelf && <span className="participants__you"> (ви)</span>}
                </span>
                {!t.isSelf && (
                  <button
                    type="button"
                    className="participants__remove"
                    aria-label="Зняти права"
                    disabled={revoke.isPending}
                    onClick={() => askRevoke(t)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="participants__add">
            <input
              className="participants__search"
              placeholder="Додати тренера (ім'я або @username)"
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
                      disabled={grant.isPending}
                      onClick={() => {
                        grant.mutate(u.id);
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
          </div>

          {(grant.isError || revoke.isError) && (
            <p className="form__error">
              Не вдалося змінити права. Спробуйте ще раз.
            </p>
          )}

          <p className="field__hint">
            Шукати можна лише серед користувачів, які вже відкривали застосунок.
          </p>
        </>
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
