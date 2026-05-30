export const PERMISSION = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type Role = (typeof PERMISSION)[keyof typeof PERMISSION];

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

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  createdBy: number;
}

export interface CreateEventRequest {
  title: string;
  startsAt: string;
  endsAt: string;
}
