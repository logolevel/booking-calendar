import { useState, type ReactNode } from 'react';
import type {
  DirectoryGuestDto,
  DirectoryUserDto,
} from '@tg-calendar/shared-types';
import { Sheet } from '../../../shared/ui/Sheet';
import { PersonName } from '../../../shared/ui/PersonName';
import { useDirectory } from '../useDirectory';
import { EditUserSheet } from './EditUserSheet';

interface Props {
  onClose: () => void;
}

function UserRow({
  user,
  onEdit,
}: {
  user: DirectoryUserDto;
  onEdit?: (user: DirectoryUserDto) => void;
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
    </li>
  );
}

function GuestRow({ guest }: { guest: DirectoryGuestDto }): JSX.Element {
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

          <Section title="Власники абонементів" count={data.subscribers.length}>
            {data.subscribers.map((u) => (
              <UserRow key={u.userId} user={u} onEdit={setEditing} />
            ))}
          </Section>

          <Section title="Учасники" count={data.members.length}>
            {data.members.map((u) => (
              <UserRow key={u.userId} user={u} onEdit={setEditing} />
            ))}
          </Section>

          <Section title="Гості" count={data.guests.length}>
            {data.guests.map((g) => (
              <GuestRow key={g.id} guest={g} />
            ))}
          </Section>
        </>
      )}

      {editing && (
        <EditUserSheet user={editing} onClose={() => setEditing(null)} />
      )}
    </Sheet>
  );
}
