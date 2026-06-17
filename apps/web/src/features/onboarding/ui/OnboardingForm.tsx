import type { MeResponse } from '@tg-calendar/shared-types';
import { ProfileForm } from '../../../shared/ui/ProfileForm';
import { useOnboarding } from '../useOnboarding';

interface Props {
  me: MeResponse;
}

// Cyrillic letters plus apostrophe/hyphen/space (Ukrainian names).
const UKRAINIAN = /^[\u0400-\u04FF'’ʼ\- ]+$/;

function isUkrainian(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && UKRAINIAN.test(trimmed);
}

// Prefill from Telegram only when the value is already in Ukrainian.
function prefill(value?: string): string {
  return value && isUkrainian(value) ? value : '';
}

export function OnboardingForm({ me }: Props): JSX.Element {
  const mutation = useOnboarding();

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <h1 className="onboarding__title">Вітаємо! 👋</h1>
        <p className="onboarding__subtitle">
          Заповніть профіль українською мовою. Усі поля обов'язкові. Змінити
          ім'я згодом можна лише через адміністратора.
        </p>

        <ProfileForm
          initialLastName={prefill(me.lastName)}
          initialFirstName={prefill(me.firstName)}
          initialGender={me.gender}
          isPending={mutation.isPending}
          isError={mutation.isError}
          errorText="Не вдалося зберегти. Спробуйте ще раз."
          submitLabel="Зберегти"
          pendingLabel="Збереження…"
          onDirty={() => mutation.reset()}
          onSubmit={(values) => mutation.mutate(values)}
        />
      </div>
    </div>
  );
}
