import { useState } from 'react';
import { GENDER, type Gender } from '@tg-calendar/shared-types';
import { Button } from '../../../shared/ui/Button';
import {
  useGuestSearch,
  type useParticipationActions,
} from '../useParticipation';

// Cyrillic letters plus apostrophe/hyphen/space (Ukrainian names).
const UKRAINIAN = /^[\u0400-\u04FF'’ʼ\- ]+$/;

function isUkrainian(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && UKRAINIAN.test(trimmed);
}

interface Props {
  actions: ReturnType<typeof useParticipationActions>;
  existingGuestIds: Set<string>;
  // Quota used up (or event full): keep visible but inactive.
  disabled: boolean;
}

export function AddGuest({
  actions,
  existingGuestIds,
  disabled,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const search = useGuestSearch(query);

  const lastValid = isUkrainian(lastName);
  const firstValid = isUkrainian(firstName);
  const showLangError =
    (lastName.trim().length > 0 && !lastValid) ||
    (firstName.trim().length > 0 && !firstValid);
  const canCreate = lastValid && firstValid && gender !== null;

  const results = (search.data ?? []).filter(
    (g) => !existingGuestIds.has(g.id),
  );

  const reset = (): void => {
    setQuery('');
    setLastName('');
    setFirstName('');
    setGender(null);
  };

  const close = (): void => {
    reset();
    setOpen(false);
  };

  const submitNew = (): void => {
    if (!canCreate || gender === null) {
      return;
    }
    actions.createNewGuest.mutate(
      { lastName: lastName.trim(), firstName: firstName.trim(), gender },
      { onSuccess: close },
    );
  };

  return (
    <div className="participants__group">
      <label className="participants__checkbox">
        <input
          type="checkbox"
          checked={open && !disabled}
          disabled={disabled}
          onChange={(e) => (e.target.checked ? setOpen(true) : close())}
        />
        Додати гостя зі списку
      </label>

      {open && !disabled && (
        <div className="participants__group-form">
          <input
            className="participants__search"
            placeholder="Пошук серед гостей"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim().length >= 2 && (
            <ul className="participants__results">
              {results.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className="participants__result"
                    disabled={actions.isPending}
                    onClick={() => {
                      actions.addGuest.mutate(g.id, { onSuccess: close });
                    }}
                  >
                    {g.name}
                  </button>
                </li>
              ))}
              {!search.isLoading && results.length === 0 && (
                <li className="participants__empty">Гостей не знайдено</li>
              )}
            </ul>
          )}

          <div className="participants__subtitle">Додати нового гостя</div>
          <input
            className="participants__search"
            placeholder="Прізвище"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            className="participants__search"
            placeholder="Ім'я"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          {showLangError && (
            <p className="form__error">
              Ім'я та прізвище мають бути українською мовою.
            </p>
          )}
          <div className="gender-select">
            <button
              type="button"
              className={`gender-select__btn${
                gender === GENDER.FEMALE ? ' gender-select__btn--female' : ''
              }`}
              onClick={() => setGender(GENDER.FEMALE)}
            >
              Дівчина
            </button>
            <button
              type="button"
              className={`gender-select__btn${
                gender === GENDER.MALE ? ' gender-select__btn--male' : ''
              }`}
              onClick={() => setGender(GENDER.MALE)}
            >
              Хлопець
            </button>
          </div>
          <Button
            block
            disabled={!canCreate || actions.isPending}
            onClick={submitNew}
          >
            Додати нового гостя
          </Button>
        </div>
      )}
    </div>
  );
}
