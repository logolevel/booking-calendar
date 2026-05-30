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
} as const;

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export const RESOURCE_IDS = [1, 2] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 8;
export const DEFAULT_CAPACITY = 6;

// Fallback used when no value is configured in the database.
export const DEFAULT_MAX_DAYS_AHEAD = 7;

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
}

export interface OnboardingRequest {
  firstName: string;
  lastName: string;
  gender: Gender;
}

// Header used by an admin to preview the app as another role.
export const PREVIEW_ROLE_HEADER = 'x-preview-role';

export interface EventDto {
  id: string;
  type: EventType;
  resourceId: ResourceId;
  title: string | null;
  capacity: number;
  startsAt: string;
  endsAt: string;
  createdBy: number;
}

export interface CreateEventRequest {
  type: EventType;
  resourceId: ResourceId;
  title?: string;
  capacity: number;
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
  name: string;
  gender: Gender | null;
  isAdmin: boolean;
  addedByUserId: number;
  addedByName: string;
  isSelf: boolean;
  canRemove: boolean;
  joinedAt: string;
}

export interface WaitlistEntryDto {
  userId: number;
  name: string;
  gender: Gender | null;
  isAdmin: boolean;
  isSelf: boolean;
  createdAt: string;
}

export interface ParticipationLogDto {
  id: string;
  action: ParticipationAction;
  actorName: string;
  targetName: string | null;
  at: string;
}

export interface EventParticipantsResponse {
  eventId: string;
  capacity: number;
  count: number;
  isFull: boolean;
  isParticipant: boolean;
  isWaitlisted: boolean;
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
