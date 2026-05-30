import { useState } from 'react';
import { GENDER, type Gender, type MeResponse } from '@tg-calendar/shared-types';
import { Button } from '../../../shared/ui/Button';
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
  const [lastName, setLastName] = useState(() => prefill(me.lastName));
  const [firstName, setFirstName] = useState(() => prefill(me.firstName));
  const [gender, setGender] = useState<Gender | null>(me.gender);
  const mutation = useOnboarding();

  const lastNameValid = isUkrainian(lastName);
  const firstNameValid = isUkrainian(firstName);
  const showLangError =
    (lastName.trim().length > 0 && !lastNameValid) ||
    (firstName.trim().length > 0 && !firstNameValid);
  const canSubmit = lastNameValid && firstNameValid && gender !== null;

  const submit = (): void => {
    if (!canSubmit || gender === null) {
      return;
    }
    mutation.mutate({
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      gender,
    });
  };

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <h1 className="onboarding__title">Вітаємо! 👋</h1>
        <p className="onboarding__subtitle">
          Заповніть профіль українською мовою. Усі поля обов'язкові. Змінити
          ім'я згодом можна лише через адміністратора.
        </p>

        <label className="field">
          <span className="field__label">Прізвище</span>
          <input
            className="field__input"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              mutation.reset();
            }}
          />
        </label>

        <label className="field">
          <span className="field__label">Ім'я</span>
          <input
            className="field__input"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              mutation.reset();
            }}
          />
        </label>

        {showLangError && (
          <p className="form__error">
            Ім'я та прізвище мають бути українською мовою.
          </p>
        )}

        <div className="field">
          <span className="field__label">Стать</span>
          <div className="gender-select">
            <button
              type="button"
              className={`gender-select__btn${
                gender === GENDER.FEMALE ? ' gender-select__btn--female' : ''
              }`}
              onClick={() => {
                setGender(GENDER.FEMALE);
                mutation.reset();
              }}
            >
              Дівчина
            </button>
            <button
              type="button"
              className={`gender-select__btn${
                gender === GENDER.MALE ? ' gender-select__btn--male' : ''
              }`}
              onClick={() => {
                setGender(GENDER.MALE);
                mutation.reset();
              }}
            >
              Хлопець
            </button>
          </div>
        </div>

        {mutation.isError && (
          <p className="form__error">Не вдалося зберегти. Спробуйте ще раз.</p>
        )}

        <Button block disabled={!canSubmit || mutation.isPending} onClick={submit}>
          {mutation.isPending ? 'Збереження…' : 'Зберегти'}
        </Button>
      </div>
    </div>
  );
}
