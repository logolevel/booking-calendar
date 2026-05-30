import { GENDER, type Gender } from '@tg-calendar/shared-types';

interface Props {
  name: string;
  gender: Gender | null;
  isAdmin: boolean;
  // A registered app user (not an outside guest).
  isUser: boolean;
}

export function PersonName({ name, gender, isAdmin, isUser }: Props): JSX.Element {
  const genderClass =
    gender === GENDER.FEMALE
      ? ' person--female'
      : gender === GENDER.MALE
        ? ' person--male'
        : '';
  const badge = isAdmin ? '👑' : isUser ? '👤' : '';

  return (
    <span className={`person${genderClass}`}>
      {badge && <span className="person__badge">{badge}</span>}
      {name}
    </span>
  );
}
