import { createServerFn } from '@tanstack/react-start';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { payment } from '@/config/db/schema';
import { resolveCurrentBillingState } from '@/core/workspace-lib/billing-state';
import { requireSession } from '@/core/workspace-lib/session';
import type { Subscription } from '@/core/workspace-lib/payment/types';
import { and, desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({});

/**
 * Get user's current plan with subscription and lifetime status.
 *
 * Migrated from BeatAPI's next-safe-action `getCurrentPlanAction`.
 * The schema is an empty object (`z.object({})`); hooks call with
 * `{ data: {} }`. Returns { success, data: {...} } directly.
 */
export const getCurrentPlanFn = createServerFn()
  .inputValidator(schema)
  .handler(async () => {
    const session = await requireSession();
    const userId = session.user.id;

    try {
      const db = await getDb();
      const payments = await db
        .select({
          id: payment.id,
          userId: payment.userId,
          priceId: payment.priceId,
          customerId: payment.customerId,
          subscriptionId: payment.subscriptionId,
          type: payment.type,
          status: payment.status,
          scene: payment.scene,
          interval: payment.interval,
          periodStart: payment.periodStart,
          periodEnd: payment.periodEnd,
          cancelAtPeriodEnd: payment.cancelAtPeriodEnd,
          trialStart: payment.trialStart,
          trialEnd: payment.trialEnd,
          creditsAnchorAt: payment.creditsAnchorAt,
          nextPriceId: payment.nextPriceId,
          lastPlanChangeAt: payment.lastPlanChangeAt,
          paid: payment.paid,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        })
        .from(payment)
        .where(
          and(
            eq(payment.paid, true),
            eq(payment.userId, userId),
            or(eq(payment.type, 'subscription'), eq(payment.type, 'one_time'))
          )
        )
        .orderBy(desc(payment.createdAt));

      const {
        currentPlan,
        subscription,
        activeSubscriptionsCount,
        hasMultipleActiveSubscriptions,
        creditsAnchorAt,
        scheduledChange,
      } = resolveCurrentBillingState({
        payments,
      });

      return {
        success: true as const,
        data: {
          currentPlan,
          subscription: subscription as Subscription | null,
          activeSubscriptionsCount,
          hasMultipleActiveSubscriptions,
          creditsAnchorAt,
          scheduledChange,
        },
      };
    } catch (error) {
      console.error('Check current plan error:', error);
      return {
        success: false as const,
        error:
          error instanceof Error ? error.message : 'Failed to get current plan',
      };
    }
  });
