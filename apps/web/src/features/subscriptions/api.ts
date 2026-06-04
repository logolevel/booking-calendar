import type {
  CreateSubscriptionRequest,
  SubscriptionListResponse,
} from '@tg-calendar/shared-types';
import { apiDelete, apiGet, apiPost } from '../../shared/api/client';

export function fetchSubscriptions(): Promise<SubscriptionListResponse> {
  return apiGet<SubscriptionListResponse>('/api/admin/subscriptions');
}

export function createSubscription(
  body: CreateSubscriptionRequest,
): Promise<SubscriptionListResponse> {
  return apiPost<SubscriptionListResponse>('/api/admin/subscriptions', body);
}

export function cancelSubscription(
  id: string,
): Promise<SubscriptionListResponse> {
  return apiDelete<SubscriptionListResponse>(`/api/admin/subscriptions/${id}`);
}
