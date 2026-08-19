import type { payment } from '@/config/db/schema';
import { findPlanByPriceId, getAllPricePlans } from '@/core/workspace-lib/price-plan';
import {
  PaymentScenes,
  type PaymentStatus,
  PaymentTypes,
  type PlanInterval,
  PlanIntervals,
  type PricePlan,
  type Subscription,
} from '@/core/workspace-lib/payment/types';

type PaymentLike = Pick<
  typeof payment.$inferSelect,
  | 'id'
  | 'userId'
  | 'priceId'
  | 'customerId'
  | 'type'
  | 'scene'
  | 'interval'
  | 'status'
  | 'paid'
  | 'periodStart'
  | 'periodEnd'
  | 'cancelAtPeriodEnd'
  | 'trialStart'
  | 'trialEnd'
  | 'createdAt'
  | 'updatedAt'
> & {
  subscriptionId?: string | null;
  creditsAnchorAt?: Date | null;
  nextPriceId?: string | null;
  lastPlanChangeAt?: Date | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<PaymentStatus>([
  'active',
  'trialing',
]);

const getPlanAmount = (plan: PricePlan | null) =>
  plan ? Math.max(...plan.prices.map((price) => price.amount), 0) : 0;

const isSubscriptionStillEntitled = (record: PaymentLike, now: Date) => {
  if (record.type !== PaymentTypes.SUBSCRIPTION || !record.paid) {
    return false;
  }

  if (ACTIVE_SUBSCRIPTION_STATUSES.has(record.status as PaymentStatus)) {
    return true;
  }

  return (
    record.status === 'canceled' &&
    record.cancelAtPeriodEnd === true &&
    !!record.periodEnd &&
    record.periodEnd.getTime() > now.getTime()
  );
};

export function deriveSubscriptionState(
  plan: PricePlan | undefined,
  interval?: PlanInterval | null
) {
  const planId = plan?.id?.toLowerCase();
  if (!plan || !planId || plan.isFree) {
    return 'free';
  }

  if (interval === PlanIntervals.YEAR) {
    return `${planId}-yearly`;
  }

  return `${planId}-monthly`;
}

export function resolveCurrentBillingState({
  payments,
  now = new Date(),
  plans = getAllPricePlans(),
  resolvePlanByPriceId = findPlanByPriceId,
}: {
  payments: PaymentLike[];
  now?: Date;
  plans?: PricePlan[];
  resolvePlanByPriceId?: (priceId: string) => PricePlan | undefined;
}) {
  const freePlan = plans.find((plan) => plan.isFree && !plan.disabled) ?? null;

  const activeSubscriptions = payments
    .filter((record) => isSubscriptionStillEntitled(record, now))
    .map((record) => ({
      record,
      plan: resolvePlanByPriceId(record.priceId) ?? null,
    }))
    .filter(
      (item): item is { record: PaymentLike; plan: PricePlan } => !!item.plan
    )
    .sort((left, right) => {
      const amountDelta = getPlanAmount(right.plan) - getPlanAmount(left.plan);
      if (amountDelta !== 0) {
        return amountDelta;
      }

      return right.record.updatedAt.getTime() - left.record.updatedAt.getTime();
    });

  const winner = activeSubscriptions[0];
  if (!winner) {
    return {
      activeSubscriptionsCount: 0,
      hasMultipleActiveSubscriptions: false,
      currentPlan: freePlan,
      subscription: null,
      subscriptionState: 'free',
      creditsAnchorAt: null,
      scheduledChange: null,
    };
  }

  const subscription: Subscription = {
    id: winner.record.subscriptionId ?? winner.record.id,
    customerId: winner.record.customerId,
    status: (winner.record.status === 'canceled'
      ? 'active'
      : winner.record.status) as PaymentStatus,
    priceId: winner.record.priceId,
    type: winner.record.type as Subscription['type'],
    interval: (winner.record.interval as PlanInterval | null) ?? undefined,
    currentPeriodStart: winner.record.periodStart ?? undefined,
    currentPeriodEnd: winner.record.periodEnd ?? undefined,
    cancelAtPeriodEnd: winner.record.cancelAtPeriodEnd ?? false,
    trialStartDate: winner.record.trialStart ?? undefined,
    trialEndDate: winner.record.trialEnd ?? undefined,
    createdAt: winner.record.createdAt,
  };

  return {
    activeSubscriptionsCount: activeSubscriptions.length,
    hasMultipleActiveSubscriptions: activeSubscriptions.length > 1,
    currentPlan: winner.plan,
    subscription,
    subscriptionState: deriveSubscriptionState(
      winner.plan,
      subscription.interval
    ),
    creditsAnchorAt:
      winner.record.creditsAnchorAt ??
      winner.record.lastPlanChangeAt ??
      winner.record.periodStart ??
      null,
    scheduledChange: winner.record.nextPriceId
      ? {
          priceId: winner.record.nextPriceId,
          planId: resolvePlanByPriceId(winner.record.nextPriceId)?.id ?? null,
        }
      : null,
  };
}

export function hasPremiumBillingAccess(
  payments: PaymentLike[],
  now = new Date()
) {
  const lifetimePlanIds = new Set(
    getAllPricePlans()
      .filter((plan) => plan.isLifetime)
      .map((plan) => plan.id)
  );

  return payments.some((record) => {
    if (
      record.type === PaymentTypes.ONE_TIME &&
      record.scene === PaymentScenes.LIFETIME &&
      record.paid &&
      record.status === 'completed'
    ) {
      const plan = findPlanByPriceId(record.priceId);
      return !!plan && lifetimePlanIds.has(plan.id);
    }

    return isSubscriptionStillEntitled(record, now);
  });
}
