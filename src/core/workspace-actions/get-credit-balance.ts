import { createServerFn } from '@tanstack/react-start';
import { getUserCredits } from '@/core/workspace-credits/credits';
import { requireSession } from '@/core/workspace-lib/session';
import { z } from 'zod';

const schema = z.object({});

/**
 * Get current user's credit balance.
 *
 * Migrated from BeatAPI's next-safe-action `getCreditBalanceAction`.
 * Returns the business payload directly (no next-safe-action envelope):
 *   { success, credits } | { success: false, error }
 * Callers (hooks) read `result.success` / `result.credits` directly.
 */
export const getCreditBalanceFn = createServerFn()
  .inputValidator(schema)
  .handler(async () => {
    try {
      const session = await requireSession();
      const credits = await getUserCredits(session.user.id);
      return { success: true as const, credits };
    } catch (error) {
      console.error('get credit balance error:', error);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch credit balance',
      };
    }
  });
