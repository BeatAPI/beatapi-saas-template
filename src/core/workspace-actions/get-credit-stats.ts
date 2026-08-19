import { createServerFn } from '@tanstack/react-start';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { creditTransaction } from '@/config/db/schema';
import { CREDITS_EXPIRATION_DAYS } from '@/core/workspace-lib/constants';
import { requireSession } from '@/core/workspace-lib/session';
import { addDays } from 'date-fns';
import { and, eq, gt, gte, isNotNull, lte, sum } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({});

/**
 * Get credit statistics for a user.
 *
 * Migrated from BeatAPI's next-safe-action `getCreditStatsAction`.
 * Returns { success, data: { expiringCredits } } directly.
 */
export const getCreditStatsFn = createServerFn()
  .inputValidator(schema)
  .handler(async () => {
    try {
      const session = await requireSession();
      const userId = session.user.id;

      const db = await getDb();
      const now = new Date();
      // Get credits expiring in the next 30 days
      const expirationDaysFromNow = addDays(now, CREDITS_EXPIRATION_DAYS);

      // Get total credits expiring in the next 30 days
      const expiringCreditsResult = await db
        .select({
          totalAmount: sum(creditTransaction.remainingAmount),
        })
        .from(creditTransaction)
        .where(
          and(
            eq(creditTransaction.userId, userId),
            isNotNull(creditTransaction.expirationDate),
            isNotNull(creditTransaction.remainingAmount),
            gt(creditTransaction.remainingAmount, 0),
            lte(creditTransaction.expirationDate, expirationDaysFromNow),
            gte(creditTransaction.expirationDate, now)
          )
        );

      const totalExpiringCredits =
        Number(expiringCreditsResult[0]?.totalAmount) || 0;

      return {
        success: true as const,
        data: {
          expiringCredits: {
            amount: totalExpiringCredits,
          },
        },
      };
    } catch (error) {
      console.error('get credit stats error:', error);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch credit statistics',
      };
    }
  });
