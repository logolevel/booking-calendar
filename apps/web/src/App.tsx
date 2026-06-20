import { useState } from 'react';
import { PREVIEW_MODE, ROLE, type PreviewMode } from '@tg-calendar/shared-types';
import { useMe } from './features/auth/useMe';
import { usePreviewRole } from './features/auth/usePreviewRole';
import { ApiError } from './shared/api/client';
import { CalendarView } from './features/calendar/ui/CalendarView';
import { OnboardingForm } from './features/onboarding/ui/OnboardingForm';
import { SettingsSheet } from './features/admin/ui/SettingsSheet';
import { AdminsSheet } from './features/admin/ui/AdminsSheet';
import { AdminMenuSheet } from './features/admin/ui/AdminMenuSheet';
import { NotificationsSheet } from './features/admin/ui/NotificationsSheet';
import { SubscriptionsSheet } from './features/subscriptions/ui/SubscriptionsSheet';
import { UsersSheet } from './features/directory/ui/UsersSheet';
import { getStartEventId } from './shared/telegram/startParam';

const PREVIEW_LABELS: Record<PreviewMode, string> = {
  [PREVIEW_MODE.ADMIN]: 'Адмін',
  [PREVIEW_MODE.SUBSCRIBER]: 'Власник абонемента',
  [PREVIEW_MODE.MEMBER]: 'Учасник',
  [PREVIEW_MODE.EXTERNAL]: 'Гість',
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [initialEventId] = useState<string | null>(() => getStartEventId());

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

  const previewMode: PreviewMode = me.isAdmin ? (preview ?? PREVIEW_MODE.ADMIN) : me.role;
  const isPreviewing = me.isAdmin && previewMode !== PREVIEW_MODE.ADMIN;

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__title">Календар</span>
        {me.isAdmin ? (
          <div className="app__header-actions">
            {isPreviewing && (
              <span className="chip chip--accent">
                {PREVIEW_LABELS[previewMode]}
              </span>
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label="Керування"
              onClick={() => setMenuOpen(true)}
            >
              ☰
            </button>
          </div>
        ) : (
          <span className="chip chip--accent">{PREVIEW_LABELS[me.role]}</span>
        )}
      </header>

      {menuOpen && (
        <AdminMenuSheet
          isAdmin={me.role === ROLE.ADMIN}
          previewMode={previewMode}
          onPreviewChange={setPreview}
          onUsers={() => setUsersOpen(true)}
          onSubs={() => setSubsOpen(true)}
          onAdmins={() => setAdminsOpen(true)}
          onNotifications={() => setNotificationsOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onClose={() => setMenuOpen(false)}
        />
      )}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {adminsOpen && <AdminsSheet onClose={() => setAdminsOpen(false)} />}
      {subsOpen && <SubscriptionsSheet onClose={() => setSubsOpen(false)} />}
      {usersOpen && <UsersSheet onClose={() => setUsersOpen(false)} />}
      {notificationsOpen && (
        <NotificationsSheet onClose={() => setNotificationsOpen(false)} />
      )}
      <main className="app__main">
        {isPreviewing && (
          <div className="preview-bar">
            <span>👁 Перегляд як «{PREVIEW_LABELS[previewMode]}»</span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setPreview(null)}
            >
              Скинути
            </button>
          </div>
        )}
        <CalendarView
          role={me.role}
          maxDaysAhead={me.maxDaysAhead}
          bookingOpenHour={me.bookingOpenHour}
          primeStart={me.primeStart}
          primeEnd={me.primeEnd}
          subPrimeStart={me.subPrimeStart}
          subPrimeEnd={me.subPrimeEnd}
          primeMemberOpenHour={me.primeMemberOpenHour}
          isSubscriber={me.isSubscriber}
          initialEventId={initialEventId}
        />
      </main>
    </div>
  );
}
