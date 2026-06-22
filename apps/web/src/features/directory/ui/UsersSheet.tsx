import { useState, type ReactNode } from 'react';
import type {
  DirectoryGuestDto,
  DirectoryUserDto,
} from '@tg-calendar/shared-types';
import { Sheet } from '../../../shared/ui/Sheet';
import { PersonName } from '../../../shared/ui/PersonName';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { useDeleteGuest, useDeleteUser, useDirectory } from '../useDirectory';
import { EditUserSheet } from './EditUserSheet';

interface Props {
  onClose: () => void;
}

function UserRow({
  user,
  onEdit,
  onDelete,
  disabled,
}: {
  user: DirectoryUserDto;
  onEdit?: (user: DirectoryUserDto) => void;
  onDelete?: (user: DirectoryUserDto) => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <li className="participants__item">
      <span className="participants__name">
        <PersonName
          name={user.name}
          gender={user.gender}
          isAdmin={user.isAdmin}
          isUser
          isRoot={user.isRoot}
          isTrainer={user.isTrainer}
          isSubscriber={user.isSubscriber}
        />
        {user.username && (
          <span className="participants__by"> @{user.username}</span>
        )}
      </span>
      {/* The root admin is never editable. */}
      {onEdit && !user.isRoot && (
        <button
          type="button"
          className="icon-btn"
          aria-label="Редагувати"
          onClick={() => onEdit(user)}
        >
          ✏️
        </button>
      )}
      {onDelete && !user.isRoot && (
        <button
          type="button"
          className="participants__remove"
          aria-label="Видалити"
          disabled={disabled}
          onClick={() => onDelete(user)}
        >
          ✕
        </button>
      )}
    </li>
  );
}

function GuestRow({
  guest,
  onDelete,
  disabled,
}: {
  guest: DirectoryGuestDto;
  onDelete: (guest: DirectoryGuestDto) => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <li className="participants__item">
      <span className="participants__name">
        <PersonName
          name={guest.name}
          gender={guest.gender}
          isAdmin={false}
          isUser={false}
        />
      </span>
      <button
        type="button"
        className="participants__remove"
        aria-label="Видалити"
        disabled={disabled}
        onClick={() => onDelete(guest)}
      >
        ✕
      </button>
    </li>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="directory__section">
      <h3 className="directory__heading">
        {title}
        <span className="directory__count">{count}</span>
      </h3>
      {count === 0 ? (
        <p className="participants__empty">Порожньо</p>
      ) : (
        <ul className="participants__list">{children}</ul>
      )}
    </section>
  );
}

export function UsersSheet({ onClose }: Props): JSX.Element {
  const { data, isLoading, isError } = useDirectory(true);
  const [editing, setEditing] = useState<DirectoryUserDto | null>(null);
  const deleteUser = useDeleteUser();
  const deleteGuest = useDeleteGuest();
  const [confirm, setConfirm] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const removing = deleteUser.isPending || deleteGuest.isPending;

  const askDeleteUser = (user: DirectoryUserDto): void => {
    setConfirm({
      message: `Видалити ${user.name} з бази застосунку? Користувача приберуть з усіх майбутніх подій. Це не виключає його з групи Telegram.`,
      onConfirm: () => deleteUser.mutate(user.userId),
    });
  };

  const askDeleteGuest = (guest: DirectoryGuestDto): void => {
    setConfirm({
      message: `Видалити гостя ${guest.name}? Його приберуть з усіх майбутніх подій.`,
      onConfirm: () => deleteGuest.mutate(guest.id),
    });
  };

  return (
    <Sheet title="Користувачі" onClose={onClose}>
      {isLoading && <p className="state__text">Завантаження…</p>}
      {isError && <p className="form__error">Не вдалося завантажити список.</p>}

      {data && (
        <>
          <p className="directory__total">
            Усього: <strong>{data.total}</strong>
          </p>

          {(() => {
            const roots = data.admins.filter((u) => u.isRoot);
            const admins = data.admins.filter((u) => !u.isRoot);
            return (
              <>
                <Section title="Root" count={roots.length}>
                  {roots.map((u) => (
                    <UserRow key={u.userId} user={u} />
                  ))}
                </Section>

                <Section title="Адміністратори" count={admins.length}>
                  {admins.map((u) => (
                    <UserRow key={u.userId} user={u} onEdit={setEditing} />
                  ))}
                </Section>
              </>
            );
          })()}

          <Section title="Тренери" count={data.trainers.length}>
            {data.trainers.map((u) => (
              <UserRow
                key={u.userId}
                user={u}
                onEdit={setEditing}
                onDelete={askDeleteUser}
                disabled={removing}
              />
            ))}
          </Section>

          <Section title="Власники абонементів" count={data.subscribers.length}>
            {data.subscribers.map((u) => (
              <UserRow
                key={u.userId}
                user={u}
                onEdit={setEditing}
                onDelete={askDeleteUser}
                disabled={removing}
              />
            ))}
          </Section>

          <Section title="Учасники" count={data.members.length}>
            {data.members.map((u) => (
              <UserRow
                key={u.userId}
                user={u}
                onEdit={setEditing}
                onDelete={askDeleteUser}
                disabled={removing}
              />
            ))}
          </Section>

          <Section title="Гості" count={data.guests.length}>
            {data.guests.map((g) => (
              <GuestRow
                key={g.id}
                guest={g}
                onDelete={askDeleteGuest}
                disabled={removing}
              />
            ))}
          </Section>

          {(deleteUser.isError || deleteGuest.isError) && (
            <p className="form__error">
              Не вдалося видалити. Можливо, спочатку зніміть права адміністратора.
            </p>
          )}

          <p className="field__hint">
            Щоб видалити адміністратора, спершу зніміть з нього права у розділі
            «Адміністратори».
          </p>
        </>
      )}

      {editing && (
        <EditUserSheet user={editing} onClose={() => setEditing(null)} />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel="Видалити"
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
