import { useQuery } from '@tanstack/react-query';
import type { MeResponse } from '@tg-calendar/shared-types';

async function fetchMe(): Promise<MeResponse> {
  const initData = window.Telegram?.WebApp.initData ?? '';
  const res = await fetch('/api/me', {
    headers: { Authorization: `tma ${initData}` },
  });
  if (res.status === 401) {
    throw new Error('unauthorized');
  }
  if (res.status === 403) {
    throw new Error('forbidden');
  }
  if (!res.ok) {
    throw new Error('request_failed');
  }
  return (await res.json()) as MeResponse;
}

export function App(): JSX.Element {
  const { data, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
  });

  const containerStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    padding: '24px',
    color: 'var(--tg-theme-text-color, #000)',
    background: 'var(--tg-theme-bg-color, #fff)',
    minHeight: '100vh',
  };

  if (isLoading) {
    return (
      <main style={containerStyle}>
        <p>Завантаження…</p>
      </main>
    );
  }

  if (error) {
    const forbidden = error instanceof Error && error.message === 'forbidden';
    return (
      <main style={containerStyle}>
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
      <h1>TG Calendar</h1>
      <p>Вітаємо, {data?.firstName}!</p>
      <p>Роль: {data?.role}</p>
    </main>
  );
}
