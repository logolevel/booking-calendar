export const ROLE = {
  ADMIN: 'admin',
  MEMBER: 'member',
  EXTERNAL: 'external',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
} as const;

export type Gender = (typeof GENDER)[keyof typeof GENDER];

export const EVENT_TYPE = {
  WOMEN: 'women',
  MEN: 'men',
  MIXED: 'mixed',
  INDIVIDUAL: 'individual',
  TECH_WOMEN: 'tech_women',
  TECH_MEN: 'tech_men',
  // Outside group booking (admin-only): no sign-up list, just an organizer.
  GROUP: 'group',
} as const;

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export const RESOURCE_IDS = [1, 2] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export const MIN_CAPACITY = 2;
export const MAX_CAPACITY = 8;
export const DEFAULT_CAPACITY = 6;

// Fallback used when no value is configured in the database.
export const DEFAULT_MAX_DAYS_AHEAD = 7;

// The furthest bookable day for regular users opens at this local hour
// (Europe/Kyiv) instead of midnight, to avoid a midnight sign-up rush.
export const BOOKING_OPEN_HOUR = 10;

// Prime time is the busiest window (Europe/Kyiv). Each user may book at most
// two prime-time slots per week, with at most one of them on the green court.
export const PRIME_TIME_DEFAULT_START = '18:30';
export const PRIME_TIME_DEFAULT_END = '20:30';
export const PRIME_TIME_MAX_PER_WEEK = 2;
export const PRIME_TIME_MAX_GREEN_PER_WEEK = 1;
// Access gate for regular members: prime-time slots open from this local hour
// (Europe/Kyiv) on the day before the event. Subscribers and admins are not
// gated (full booking window); the weekly quota above still applies to all.
export const PRIME_TIME_MEMBER_OPEN_HOUR = 12;

// Subscriptions are granted for a whole number of months (a season = 12).
export const SUBSCRIPTION_MIN_MONTHS = 1;
export const SUBSCRIPTION_MAX_MONTHS = 12;
export const SUBSCRIPTION_SEASON_MONTHS = 12;
export const SUBSCRIPTION_DEFAULT_MONTHS = 1;

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface MeResponse {
  id: number;
  // Effective role (may be a previewed role when the real user is an admin).
  role: Role;
  // True when the real authenticated user is an admin, regardless of preview.
  isAdmin: boolean;
  firstName: string;
  lastName?: string;
  username?: string;
  gender: Gender | null;
  // Onboarding done: name + gender provided.
  profileComplete: boolean;
  maxDaysAhead: number;
  // Local hour (Europe/Kyiv) when the furthest bookable day opens.
  bookingOpenHour: number;
}

export interface OnboardingRequest {
  firstName: string;
  lastName: string;
  gender: Gender;
}

export interface AdminSettingsResponse {
  maxDaysAhead: number;
  bookingOpenHour: number;
  // Prime-time window as "HH:MM" strings in Europe/Kyiv.
  primeStart: string;
  primeEnd: string;
  // Local hour the prime-time access gate opens for regular members
  // (on the day before the event); subscribers and admins are not gated.
  primeMemberOpenHour: number;
}

export interface UpdateAdminSettingsRequest {
  maxDaysAhead: number;
  bookingOpenHour: number;
  primeStart: string;
  primeEnd: string;
  primeMemberOpenHour: number;
  // When true, broadcast the changes to every registered user.
  notify: boolean;
}

// An admin entry shown in the admin management list.
export interface AdminUserDto {
  userId: number;
  name: string;
  username: string | null;
  gender: Gender | null;
  // The immutable super-admin from ADMIN_ID (cannot be revoked).
  isRoot: boolean;
  // True when this row is the current viewer.
  isSelf: boolean;
}

export interface AdminListResponse {
  admins: AdminUserDto[];
}

export interface GrantAdminRequest {
  userId: number;
}

// Header used by an admin to preview the app as another role.
export const PREVIEW_ROLE_HEADER = 'x-preview-role';

export interface EventDto {
  id: string;
  type: EventType;
  resourceId: ResourceId;
  title: string | null;
  capacity: number;
  // Current number of participants (used for the calendar fill indicator).
  participantCount: number;
  // Group events only: organizer name, optional contact phone and head count.
  organizerName: string | null;
  organizerPhone: string | null;
  groupSize: number | null;
  startsAt: string;
  endsAt: string;
  createdBy: number;
}

export interface CreateEventRequest {
  type: EventType;
  resourceId: ResourceId;
  title?: string;
  capacity: number;
  organizerName?: string;
  organizerPhone?: string;
  groupSize?: number;
  // Admin only: create the event without joining it themselves.
  skipSelf?: boolean;
  startsAt: string;
  endsAt: string;
}

export type UpdateEventRequest = CreateEventRequest;

export const PARTICIPATION_ACTION = {
  JOIN: 'join',
  ADD: 'add',
  LEAVE: 'leave',
  REMOVE: 'remove',
  PROMOTED: 'promoted',
} as const;

export type ParticipationAction =
  (typeof PARTICIPATION_ACTION)[keyof typeof PARTICIPATION_ACTION];

export interface ParticipantDto {
  id: string;
  userId: number | null;
  // Set for an outside guest (no Telegram account, not in the directory).
  guestId: string | null;
  name: string;
  gender: Gender | null;
  isAdmin: boolean;
  // The root super-admin (ADMIN_ID); shown with a snowflake instead of a crown.
  isRoot: boolean;
  isGuest: boolean;
  addedByUserId: number;
  addedByName: string;
  // Gender of the user who added this participant (for verb agreement).
  addedByGender: Gender | null;
  isSelf: boolean;
  canRemove: boolean;
  joinedAt: string;
}

export interface WaitlistEntryDto {
  userId: number;
  name: string;
  gender: Gender | null;
  isAdmin: boolean;
  isRoot: boolean;
  isSelf: boolean;
  createdAt: string;
}

export interface ParticipationLogDto {
  id: string;
  action: ParticipationAction;
  actorName: string;
  // Gender of the actor (for choosing the correct verb form).
  actorGender: Gender | null;
  targetName: string | null;
  at: string;
}

export interface EventParticipantsResponse {
  eventId: string;
  // True when the event was auto-deleted (last member left an empty event).
  deleted?: boolean;
  capacity: number;
  count: number;
  isFull: boolean;
  isParticipant: boolean;
  isWaitlisted: boolean;
  isAdmin: boolean;
  // True when the viewer is the event author (creator / promoted owner).
  isAuthor: boolean;
  // True when the viewer may add an extra right now (quota free, not full).
  canAddPlusOne: boolean;
  participants: ParticipantDto[];
  waitlist: WaitlistEntryDto[];
  log: ParticipationLogDto[];
}

export interface AddParticipantRequest {
  userId: number;
}

export interface UserSearchResult {
  id: number;
  name: string;
  username: string | null;
}

// Reusable outside guest (not part of the group directory).
export interface GuestDto {
  id: string;
  name: string;
  gender: Gender;
}

export interface CreateGuestRequest {
  firstName: string;
  lastName: string;
  gender: Gender;
}

export interface AddExistingGuestRequest {
  guestId: string;
}

// A subscription record (purchase history); active when startsAt <= now <= endsAt.
export interface SubscriptionDto {
  id: string;
  userId: number;
  userName: string;
  gender: Gender | null;
  startsAt: string;
  endsAt: string;
  months: number;
  note: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  isActive: boolean;
}

export interface SubscriptionListResponse {
  subscriptions: SubscriptionDto[];
}

export interface CreateSubscriptionRequest {
  userId: number;
  months: number;
  note?: string;
}

// Full user directory, grouped into categories for the admin overview.
export interface DirectoryUserDto {
  userId: number;
  name: string;
  username: string | null;
  gender: Gender | null;
  isRoot: boolean;
  isAdmin: boolean;
  // Has an active subscription right now.
  isSubscriber: boolean;
}

export interface DirectoryGuestDto {
  id: string;
  name: string;
  gender: Gender;
}

export interface UsersDirectoryResponse {
  // Grand total across every category (admins + subscribers + members + guests).
  total: number;
  admins: DirectoryUserDto[];
  // Non-admin users with an active subscription.
  subscribers: DirectoryUserDto[];
  // Remaining registered users (group members / external).
  members: DirectoryUserDto[];
  // Outside guests (not part of the group directory).
  guests: DirectoryGuestDto[];
}
