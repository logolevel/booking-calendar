import type { MeResponse, OnboardingRequest } from '@tg-calendar/shared-types';
import { apiPost } from '../../shared/api/client';

export function submitOnboarding(
  body: OnboardingRequest,
): Promise<MeResponse> {
  return apiPost<MeResponse>('/api/me/onboarding', body);
}
