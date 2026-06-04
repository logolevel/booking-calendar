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
  // Plain (monochrome) snowflake for root; crown for other admins.
  // U+FE0E forces text (non-emoji) presentation of the snowflake.
  const roleBadge = isRoot ? '\u2744\uFE0E' : isAdmin ? '👑' : isUser ? '👤' : '';
  const badge = `${roleBadge}${isSubscriber ? '⭐' : ''}`;

  return (
    <span className={`person${genderClass}`}>
      {badge && <span className="person__badge">{badge}</span>}
      {name}
    </span>
  );
}
