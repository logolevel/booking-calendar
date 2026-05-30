import { useMe } from './features/auth/useMe';
import { ApiError } from './shared/api/client';
import { CalendarView } from './features/calendar/ui/CalendarView';

const containerStyle: React.CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  color: 'var(--tg-theme-text-color, #000)',
  background: 'var(--tg-theme-bg-color, #fff)',
  minHeight: '100vh',
};

export function App(): JSX.Element {
  const { data: me, isLoading, error } = useMe();

  if (isLoading) {
    return (
      <main style={{ ...containerStyle, padding: 24 }}>
        <p>Завантаження…</p>
      </main>
    );
  }

  if (error) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <main style={{ ...containerStyle, padding: 24 }}>
        <h1>TG Calendar</h1>
        <p>
          {forbidden
            ? 'Доступ лише для учасників групи. Зверніться до адміністратора.'
            : 'Не вдалося авторизуватися. Відкрийте застосунок через Telegram.'}
        </p>
      </main>
    );
  }

  return (
    <main style={containerStyle}>
      <CalendarView role={me?.role ?? 'external'} />
    </main>
  );
}
