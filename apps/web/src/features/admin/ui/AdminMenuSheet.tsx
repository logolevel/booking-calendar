import { PREVIEW_MODE, type PreviewMode } from '@tg-calendar/shared-types';
import { Sheet } from '../../../shared/ui/Sheet';
import { RoleSwitch } from '../../auth/ui/RoleSwitch';

interface Props {
  // Whether the real user is a full admin (only then the management actions
  // are shown; a previewing admin keeps just the role switch).
  isAdmin: boolean;
  previewMode: PreviewMode;
  onPreviewChange: (mode: PreviewMode | null) => void;
  onUsers: () => void;
  onSubs: () => void;
  onAdmins: () => void;
  onTrainers: () => void;
  onNotifications: () => void;
  onSettings: () => void;
  onClose: () => void;
}

const ITEMS: { icon: string; label: string; key: keyof Pick<
  Props,
  'onUsers' | 'onSubs' | 'onAdmins' | 'onTrainers' | 'onNotifications' | 'onSettings'
> }[] = [
  { icon: '👥', label: 'Користувачі', key: 'onUsers' },
  { icon: '⭐', label: 'Абонементи', key: 'onSubs' },
  { icon: '👑', label: 'Адміністратори', key: 'onAdmins' },
  { icon: '🥋', label: 'Тренери', key: 'onTrainers' },
  { icon: '🔔', label: 'Сповіщення', key: 'onNotifications' },
  { icon: '⚙️', label: 'Налаштування', key: 'onSettings' },
];

// Consolidates all admin header controls into one modal so the header stays
// compact (avoids horizontal overflow on mobile).
export function AdminMenuSheet(props: Props): JSX.Element {
  const { isAdmin, previewMode, onPreviewChange, onClose } = props;
  return (
    <Sheet title="Керування" onClose={onClose}>
      {isAdmin && (
        <ul className="admin-menu">
          {ITEMS.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className="admin-menu__item"
                onClick={() => {
                  onClose();
                  props[item.key]();
                }}
              >
                <span className="admin-menu__icon">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="admin-menu__section">
        <div className="admin-menu__label">Переглянути як роль</div>
        <RoleSwitch
          value={previewMode}
          onChange={(mode) => {
            onPreviewChange(mode === PREVIEW_MODE.ADMIN ? null : mode);
          }}
        />
      </div>
    </Sheet>
  );
}
