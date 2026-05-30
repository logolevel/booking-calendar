import { ROLE, type Role } from '@tg-calendar/shared-types';

const OPTIONS: { value: Role; label: string }[] = [
  { value: ROLE.ADMIN, label: 'Адмін' },
  { value: ROLE.MEMBER, label: 'Учасник' },
  { value: ROLE.EXTERNAL, label: 'Гість' },
];

interface Props {
  value: Role;
  onChange: (role: Role) => void;
}

export function RoleSwitch({ value, onChange }: Props): JSX.Element {
  return (
    <span className="role-switch">
      <select
        className="role-switch__select"
        value={value}
        aria-label="Переглянути як роль"
        onChange={(e) => onChange(e.target.value as Role)}
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
