import { GENDER, type Gender } from '@tg-calendar/shared-types';

interface Props {
  name: string;
  gender: Gender | null;
  isAdmin: boolean;
  // A registered app user (not an outside guest).
  isUser: boolean;
  // The root super-admin (ADMIN_ID): shown with a plain snowflake glyph.
  isRoot?: boolean;
  // Owns an active subscription: adds a star, may combine (e.g. 👑⭐).
  isSubscriber?: boolean;
}

export function PersonName({
  name,
  gender,
  isAdmin,
  isUser,
  isRoot = false,
  isSubscriber = false,
}: Props): JSX.Element {
  const genderClass =
    gender === GENDER.FEMALE
      ? ' person--female'
      : gender === GENDER.MALE
        ? ' person--male'
        : '';
  // Single badge by priority: root ❄️ > admin 👑 > active subscriber ⭐ > member 👤.
  // U+FE0E forces text (non-emoji) presentation of the snowflake.
  let badge = '';
  if (isRoot) {
    badge = '\u2744\uFE0E';
  } else if (isAdmin) {
    badge = '👑';
  } else if (isSubscriber) {
    badge = '⭐';
  } else if (isUser) {
    badge = '👤';
  }

  return (
    <span className={`person${genderClass}`}>
      {badge && <span className="person__badge">{badge}</span>}
      {name}
    </span>
  );
}
