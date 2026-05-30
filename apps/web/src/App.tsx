import { ROLE, type Role } from '@tg-calendar/shared-types';
import { useMe } from './features/auth/useMe';
import { usePreviewRole } from './features/auth/usePreviewRole';
import { RoleSwitch } from './features/auth/ui/RoleSwitch';
import { ApiError } from './shared/api/client';
import { CalendarView } from './features/calendar/ui/CalendarView';
import { OnboardingForm } from './features/onboarding/ui/OnboardingForm';

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
  const { preview, setPreview } = usePreviewRole();

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

  if (!me.profileComplete) {
    return (
      <div className="app">
        <OnboardingForm me={me} />
      </div>
    );
  }

  const isPreviewing = me.isAdmin && me.role !== ROLE.ADMIN;

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__title">Календар</span>
        {me.isAdmin ? (
          <RoleSwitch
            value={preview ?? ROLE.ADMIN}
            onChange={(role) => setPreview(role === ROLE.ADMIN ? null : role)}
          />
        ) : (
          <span className="chip chip--accent">{ROLE_LABELS[me.role]}</span>
        )}
      </header>
      <main className="app__main">
        {isPreviewing && (
          <div className="preview-bar">
            <span>👁 Перегляд як «{ROLE_LABELS[me.role]}»</span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setPreview(null)}
            >
              Скинути
            </button>
          </div>
        )}
        <CalendarView role={me.role} maxDaysAhead={me.maxDaysAhead} />
      </main>
    </div>
  );
}
