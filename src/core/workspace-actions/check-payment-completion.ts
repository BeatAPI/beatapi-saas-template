import { createServerFn } from '@tanstack/react-start';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { payment } from '@/config/db/schema';
import { requireSession } from '@/core/workspace-lib/session';
import { resolvePaymentLifecycleStatus } from '@/core/workspace-lib/payment-status';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const checkPaymentCompletionSchema = z.object({
  sessionId: z.string(),
});

/**
 * Check if a payment is completed for the given session ID.
 *
 * Migrated from BeatAPI's next-safe-action `checkPaymentCompletionAction`.
 * Returns { success, isPaid, status } directly.
 */
export const checkPaymentCompletionFn = createServerFn()
  .inputValidator(checkPaymentCompletionSchema)
  .handler(async ({ data }) => {
    const { sessionId } = data;

    try {
      const session = await requireSession();
      const db = await getDb();
      const paymentRecord = await db
        .select()
        .from(payment)
        .where(
          and(
            eq(payment.sessionId, sessionId),
            eq(payment.userId, session.user.id)
          )
        )
        .limit(1);

      const paymentData = paymentRecord[0] || null;
      const status = resolvePaymentLifecycleStatus(paymentData);

      return {
        success: true as const,
        isPaid: status === 'paid',
        status,
      };
    } catch (error) {
      console.error('Check payment completion error:', error);
      return {
        success: false as const,
        error: 'Failed to check payment completion',
      };
    }
  });
