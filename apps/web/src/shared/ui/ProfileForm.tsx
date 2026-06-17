import { useState } from 'react';
import { GENDER, type Gender } from '@tg-calendar/shared-types';
import { Button } from './Button';

// Cyrillic letters plus apostrophe/hyphen/space (Ukrainian names).
const UKRAINIAN = /^[\u0400-\u04FF'’ʼ\- ]+$/;

function isUkrainian(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && UKRAINIAN.test(trimmed);
}

export interface ProfileFormValues {
  lastName: string;
  firstName: string;
  gender: Gender;
}

interface Props {
  initialLastName: string;
  initialFirstName: string;
  initialGender: Gender | null;
  isPending: boolean;
  isError: boolean;
  errorText: string;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: ProfileFormValues) => void;
  // Lets the parent clear a stale mutation error on any edit.
  onDirty?: () => void;
}

// Shared profile editor used both for first-time onboarding and for an admin
// fixing another user's data. Name fields must be Ukrainian.
export function ProfileForm({
  initialLastName,
  initialFirstName,
  initialGender,
  isPending,
  isError,
  errorText,
  submitLabel,
  pendingLabel,
  onSubmit,
  onDirty,
}: Props): JSX.Element {
  const [lastName, setLastName] = useState(initialLastName);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [gender, setGender] = useState<Gender | null>(initialGender);

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
    onSubmit({
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      gender,
    });
  };

  return (
    <>
      <label className="field">
        <span className="field__label">Прізвище</span>
        <input
          className="field__input"
          value={lastName}
          onChange={(e) => {
            setLastName(e.target.value);
            onDirty?.();
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
            onDirty?.();
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
              onDirty?.();
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
              onDirty?.();
            }}
          >
            Хлопець
          </button>
        </div>
      </div>

      {isError && <p className="form__error">{errorText}</p>}

      <Button block disabled={!canSubmit || isPending} onClick={submit}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </>
  );
}
