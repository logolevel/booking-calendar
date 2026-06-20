import { useEffect, useState } from 'react';
import { Sheet } from '../../../shared/ui/Sheet';
import { Button } from '../../../shared/ui/Button';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '../useNotificationSettings';

interface Props {
  onClose: () => void;
}

interface Categories {
  createDelete: boolean;
  roster: boolean;
  other: boolean;
}

const CATEGORY_ITEMS: { key: keyof Categories; label: string }[] = [
  { key: 'createDelete', label: 'Створення/видалення' },
  { key: 'roster', label: 'Зміна складу учасників' },
  { key: 'other', label: 'Інші зміни' },
];

export function NotificationsSheet({ onClose }: Props): JSX.Element {
  const { data, isLoading, isError } = useNotificationSettings(true);
  const update = useUpdateNotificationSettings();

  // "Усі" is its own toggle: while on, the per-category checkboxes are forced
  // on and disabled. Turning it off keeps the previous per-category choices
  // editable.
  const [all, setAll] = useState(false);
  const [cats, setCats] = useState<Categories>({
    createDelete: true,
    roster: true,
    other: true,
  });

  useEffect(() => {
    if (data) {
      const everything = data.createDelete && data.roster && data.other;
      setAll(everything);
      setCats({
        createDelete: data.createDelete,
        roster: data.roster,
        other: data.other,
      });
    }
  }, [data]);

  const effective: Categories = all
    ? { createDelete: true, roster: true, other: true }
    : cats;

  const submit = (): void => {
    update.mutate(effective, { onSuccess: onClose });
  };

  return (
    <Sheet title="Сповіщення" onClose={onClose}>
      {isLoading && <p className="state__text">Завантаження…</p>}
      {isError && (
        <p className="form__error">Не вдалося завантажити налаштування.</p>
      )}

      {data && (
        <>
          <p className="field__hint">
            Оберіть, про які зміни в подіях надсилати вам сповіщення. Якщо ви
            берете участь у події, ви отримуватимете її сповіщення завжди.
          </p>

          <label className="participants__checkbox field">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            Усі
          </label>

          {CATEGORY_ITEMS.map((item) => (
            <label key={item.key} className="participants__checkbox field">
              <input
                type="checkbox"
                checked={effective[item.key]}
                disabled={all}
                onChange={(e) =>
                  setCats((prev) => ({
                    ...prev,
                    [item.key]: e.target.checked,
                  }))
                }
              />
              {item.label}
            </label>
          ))}

          {update.isError && (
            <p className="form__error">Не вдалося зберегти налаштування.</p>
          )}

          <div className="form__actions">
            <Button variant="secondary" block onClick={onClose}>
              Скасувати
            </Button>
            <Button type="button" block disabled={update.isPending} onClick={submit}>
              Зберегти
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
