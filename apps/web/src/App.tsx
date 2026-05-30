import { ROLE, type Role } from '@tg-calendar/shared-types';
import { useMe } from './features/auth/useMe';
import { ApiError } from './shared/api/client';
import { CalendarView } from './features/calendar/ui/CalendarView';

const ROLE_LABELS: Record<Role, string> = {
  [ROLE.ADMIN]: 'Адмін',
  [ROLE.MEMBER]: 'Учасник',
  [ROLE.EXTERNAL]: 'Гість',
};

function StateScreen({
  icon,
  title,
  text,
  loading = false,
}: {
  icon?: string;
  title: string;
  text?: string;
  loading?: boolean;
}): JSX.Element {
  return (
    <div className="state">
      <div className="state__card">
        {loading ? <div className="spinner" /> : <div className="state__icon">{icon}</div>}
        <p className="state__title">{title}</p>
        {text && <p className="state__text">{text}</p>}
      </div>
    </div>
  );
}

export function App(): JSX.Element {
  const { data: me, isLoading, error } = useMe();

  if (isLoading) {
    return (
      <div className="app">
        <StateScreen loading title="Завантаження…" />
      </div>
    );
  }

  if (error || !me) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <div className="app">
        <StateScreen
          icon={forbidden ? '🔒' : '⚠️'}
          title={forbidden ? 'Доступ обмежено' : 'Не вдалося авторизуватися'}
          text={
            forbidden
              ? 'Календар доступний лише учасникам групи. Зверніться до адміністратора.'
              : 'Відкрийте застосунок через Telegram.'
          }
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__title">Календар</span>
        <span className="chip chip--accent">{ROLE_LABELS[me.role]}</span>
      </header>
      <main className="app__main">
        <CalendarView role={me.role} />
      </main>
    </div>
  );
}
