import type { PlanInterval } from '@/core/workspace-lib/payment/types';
import { PlanIntervals } from '@/core/workspace-lib/payment/types';

export interface SubscriptionChangeInput {
  activeSubscriptionsCount: number;
  currentPriceId: string | null;
  currentInterval: PlanInterval | null;
  currentAmount: number | null;
  targetPriceId: string;
  targetInterval: PlanInterval;
  targetAmount: number;
}

export type SubscriptionChangeDecision =
  | {
      kind: 'blocked_multiple_active_subscriptions';
    }
  | {
      kind: 'checkout';
    }
  | {
      kind: 'noop';
    }
  | {
      kind: 'immediate_reset';
      reason: 'monthly_upgrade' | 'monthly_to_yearly';
    }
  | {
      kind: 'scheduled_downgrade';
      reason: 'monthly_downgrade';
    }
  | {
      kind: 'unsupported';
      reason: 'year_to_month' | 'year_to_year';
    };

export function classifySubscriptionChange(
  input: SubscriptionChangeInput
): SubscriptionChangeDecision {
  if (input.activeSubscriptionsCount > 1) {
    return {
      kind: 'blocked_multiple_active_subscriptions',
    };
  }

  if (
    input.activeSubscriptionsCount === 0 ||
    !input.currentPriceId ||
    !input.currentInterval ||
    input.currentAmount === null
  ) {
    return {
      kind: 'checkout',
    };
  }

  if (input.currentPriceId === input.targetPriceId) {
    return {
      kind: 'noop',
    };
  }

  if (input.currentInterval === PlanIntervals.MONTH) {
    if (input.targetInterval === PlanIntervals.YEAR) {
      return {
        kind: 'immediate_reset',
        reason: 'monthly_to_yearly',
      };
    }

    if (input.targetAmount > input.currentAmount) {
      return {
        kind: 'immediate_reset',
        reason: 'monthly_upgrade',
      };
    }

    return {
      kind: 'scheduled_downgrade',
      reason: 'monthly_downgrade',
    };
  }

  if (input.currentInterval === PlanIntervals.YEAR) {
    if (input.targetInterval === PlanIntervals.MONTH) {
      return {
        kind: 'unsupported',
        reason: 'year_to_month',
      };
    }

    return {
      kind: 'unsupported',
      reason: 'year_to_year',
    };
  }

  return {
    kind: 'unsupported',
    reason: 'year_to_month',
  };
}
