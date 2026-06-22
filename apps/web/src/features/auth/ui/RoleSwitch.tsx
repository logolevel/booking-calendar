import { PREVIEW_MODE, type PreviewMode } from '@tg-calendar/shared-types';

const OPTIONS: { value: PreviewMode; label: string }[] = [
  { value: PREVIEW_MODE.ADMIN, label: 'Адмін' },
  { value: PREVIEW_MODE.SUBSCRIBER, label: 'Власник абонемента' },
  { value: PREVIEW_MODE.MEMBER, label: 'Учасник' },
  { value: PREVIEW_MODE.TRAINER, label: 'Тренер' },
];

interface Props {
  value: PreviewMode;
  onChange: (mode: PreviewMode) => void;
}

export function RoleSwitch({ value, onChange }: Props): JSX.Element {
  return (
    <span className="role-switch">
      <select
        className="role-switch__select"
        value={value}
        aria-label="Переглянути як роль"
        onChange={(e) => onChange(e.target.value as PreviewMode)}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
