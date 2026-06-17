import type { DirectoryUserDto } from '@tg-calendar/shared-types';
import { Sheet } from '../../../shared/ui/Sheet';
import { ProfileForm } from '../../../shared/ui/ProfileForm';
import { useUpdateUserProfile } from '../useDirectory';

interface Props {
  user: DirectoryUserDto;
  onClose: () => void;
}

// Admin-only editor that reuses the onboarding profile form to fix a user's
// incorrectly entered data.
export function EditUserSheet({ user, onClose }: Props): JSX.Element {
  const mutation = useUpdateUserProfile();

  return (
    <Sheet title="Редагувати користувача" onClose={onClose}>
      <ProfileForm
        initialLastName={user.lastName ?? ''}
        initialFirstName={user.firstName}
        initialGender={user.gender}
        isPending={mutation.isPending}
        isError={mutation.isError}
        errorText="Не вдалося зберегти. Спробуйте ще раз."
        submitLabel="Зберегти"
        pendingLabel="Збереження…"
        onDirty={() => mutation.reset()}
        onSubmit={(values) =>
          mutation.mutate(
            { userId: user.userId, body: values },
            { onSuccess: onClose },
          )
        }
      />
    </Sheet>
  );
}
