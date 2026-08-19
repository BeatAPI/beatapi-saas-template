import { getCurrentPlanFn } from '@/core/workspace-actions/get-current-plan';
import { getAllPricePlans } from '@/core/workspace-lib/price-plan';
import type { PricePlan, Subscription } from '@/core/workspace-lib/types';
import { queryOptions, useQuery } from '@tanstack/react-query';

interface CurrentPlanResult {
  currentPlan: PricePlan | null;
  subscription: Subscription | null;
  activeSubscriptionsCount: number;
  hasMultipleActiveSubscriptions: boolean;
  creditsAnchorAt: Date | null;
  scheduledChange: {
    priceId: string;
    planId: string | null;
  } | null;
}

// Query keys
export const paymentKeys = {
  all: ['payment'] as const,
  currentPlan: (userId: string) =>
    [...paymentKeys.all, 'currentPlan', userId] as const,
};

export async function fetchCurrentPlan(): Promise<CurrentPlanResult> {
  const result = await getCurrentPlanFn({ data: {} });
  if (!result?.success) {
    throw new Error(result?.error || 'Failed to fetch current plan');
  }

  return (
    result.data || {
      currentPlan: getAllPricePlans().find((plan) => plan.isFree) || null,
      subscription: null,
      activeSubscriptionsCount: 0,
      hasMultipleActiveSubscriptions: false,
      creditsAnchorAt: null,
      scheduledChange: null,
    }
  );
}

export function currentPlanQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: paymentKeys.currentPlan(userId || ''),
    queryFn: async (): Promise<CurrentPlanResult> => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return fetchCurrentPlan();
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Hook to get current plan with subscription and lifetime status
export function useCurrentPlan(userId: string | undefined) {
  return useQuery(currentPlanQueryOptions(userId));
}
