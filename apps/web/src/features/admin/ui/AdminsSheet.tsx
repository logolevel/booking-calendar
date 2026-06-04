import { useState } from 'react';
import type { AdminUserDto } from '@tg-calendar/shared-types';
import { Sheet } from '../../../shared/ui/Sheet';
import { PersonName } from '../../../shared/ui/PersonName';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { useUserSearch } from '../../participation/useParticipation';
import { useAdmins, useGrantAdmin, useRevokeAdmin } from '../useAdmins';

interface Props {
  onClose: () => void;
}

export function AdminsSheet({ onClose }: Props): JSX.Element {
  const { data, isLoading, isError } = useAdmins(true);
  const grant = useGrantAdmin();
  const revoke = useRevokeAdmin();
  const [query, setQuery] = useState('');
  const search = useUserSearch(query);
  const [confirm, setConfirm] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const admins = data?.admins ?? [];
  const adminIds = new Set(admins.map((a) => a.userId));
  const results = (search.data ?? []).filter((u) => !adminIds.has(u.id));

  const askRevoke = (a: AdminUserDto): void => {
    setConfirm({
      message: `Зняти права адміністратора з ${a.name}?`,
      onConfirm: () => revoke.mutate(a.userId),
    });
  };

  return (
    <Sheet title="Адміністратори" onClose={onClose}>
      {isLoading && <p className="state__text">Завантаження…</p>}
      {isError && <p className="form__error">Не вдалося завантажити список.</p>}

      {data && (
        <>
          <ul className="participants__list">
            {admins.map((a) => (
              <li key={a.userId} className="participants__item">
                <span className="participants__name">
                  <PersonName
                    name={a.name}
                    gender={a.gender}
                    isAdmin
                    isUser
                    isRoot={a.isRoot}
                  />
                  {a.isSelf && <span className="participants__you"> (ви)</span>}
                </span>
                {!a.isRoot && !a.isSelf && (
                  <button
                    type="button"
                    className="participants__remove"
                    aria-label="Зняти права"
                    disabled={revoke.isPending}
                    onClick={() => askRevoke(a)}
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
              placeholder="Додати адміна (ім'я або @username)"
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
