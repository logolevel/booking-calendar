export const ROLE = {
  ADMIN: 'admin',
  MEMBER: 'member',
  EXTERNAL: 'external',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

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
  role: Role;
  firstName: string;
  lastName?: string;
  username?: string;
  maxDaysAhead: number;
}

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
