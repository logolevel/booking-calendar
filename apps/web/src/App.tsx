import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@tg-calendar/shared-types';

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error('Health request failed');
  }
  return (await res.json()) as HealthResponse;
}

export function App(): JSX.Element {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '24px',
        color: 'var(--tg-theme-text-color, #000)',
        background: 'var(--tg-theme-bg-color, #fff)',
        minHeight: '100vh',
      }}
    >
      <h1>TG Calendar</h1>
      <p>Telegram Mini App skeleton.</p>
      {isLoading && <p>Checking API…</p>}
      {isError && <p>API unavailable.</p>}
      {data && <p>API status: {data.status}</p>}
    </main>
  );
}
