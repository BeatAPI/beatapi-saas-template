import { refundCredits, releaseReservedCredits } from '@/core/workspace-credits/credits';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { generationHistory } from '@/config/db/schema';
import {
  EFFECTS_GENERATION_TIMEOUT_MESSAGE,
  EFFECTS_GENERATION_TIMEOUT_MS,
} from '@/core/effects/runtime-config';
import { and, eq, lt, or } from 'drizzle-orm';

export const STALE_GENERATION_TIMEOUT_MS = EFFECTS_GENERATION_TIMEOUT_MS;
export const STALE_GENERATION_ERROR_MESSAGE =
  EFFECTS_GENERATION_TIMEOUT_MESSAGE;
const FINAL_QUALITY_TIMEOUT_MESSAGE =
  'Final-quality task timed out, delivered base-quality fallback.';

type GenerationRow = typeof generationHistory.$inferSelect;

type CleanupTransition = {
  status: 'failed' | 'succeeded';
  output: Record<string, unknown>;
  error: string | null;
  shouldReleaseReservedCredits: boolean;
  shouldRefundConsumedCredits: boolean;
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

const withFallbackFromBase = (output: Record<string, unknown>) => {
  const baseResultUrl = readString(output.base_result_url);
  if (!baseResultUrl) return output;

  return {
    ...output,
    result_url: baseResultUrl,
    quality_finalized: true,
  };
};

export const isGenerationStale = ({
  status,
  createdAt,
  now = new Date(),
}: {
  status: string;
  createdAt: Date | null;
  now?: Date;
}) => {
  if (status !== 'pending' && status !== 'processing') {
    return false;
  }

  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    return false;
  }

  return now.getTime() - createdAt.getTime() > STALE_GENERATION_TIMEOUT_MS;
};

export const resolveStaleGenerationTransition = ({
  id,
  input,
  output,
}: {
  id: string;
  input: unknown;
  output: unknown;
}): CleanupTransition => {
  const outputObject = asObject(output);
  const baseResultUrl = readString(outputObject.base_result_url);

  if (baseResultUrl) {
    return {
      status: 'succeeded',
      output: withFallbackFromBase(outputObject),
      error: null,
      shouldReleaseReservedCredits: false,
      shouldRefundConsumedCredits: false,
    };
  }

  return {
    status: 'failed',
    output: { ...outputObject, wmTaskId: id },
    error: STALE_GENERATION_ERROR_MESSAGE,
    shouldReleaseReservedCredits: true,
    shouldRefundConsumedCredits: outputObject.creditsRefunded !== true,
  };
};

export async function cleanupStaleGenerations({
  now = new Date(),
}: {
  now?: Date;
} = {}) {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - STALE_GENERATION_TIMEOUT_MS);

  const rows = await db
    .select()
    .from(generationHistory)
    .where(
      and(
        or(
          eq(generationHistory.status, 'pending'),
          eq(generationHistory.status, 'processing')
        ),
        lt(generationHistory.createdAt, cutoff)
      )
    );

  let processedCount = 0;
  let failedCount = 0;
  let succeededCount = 0;
  let releasedCount = 0;
  let refundedCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    if (
      !isGenerationStale({ status: row.status, createdAt: row.createdAt, now })
    ) {
      continue;
    }

    try {
      const transition = resolveStaleGenerationTransition({
        id: row.id,
        input: row.input,
        output: row.output,
      });

      let nextOutput = transition.output;

      if (transition.shouldReleaseReservedCredits) {
        await releaseReservedCredits({
          userId: row.userId,
          referenceId: row.id,
          description: 'Released reserved credits for stale generation task',
        });
        releasedCount += 1;
      }

      if (
        transition.shouldRefundConsumedCredits &&
        row.creditsUsed > 0 &&
        asObject(nextOutput).creditsRefunded !== true
      ) {
        await refundCredits({
          userId: row.userId,
          amount: row.creditsUsed,
          description: 'Refund for failed generation',
          referenceId: row.id,
        });
        nextOutput = {
          ...asObject(nextOutput),
          creditsRefunded: true,
          wmTaskId: row.id,
        };
        refundedCount += 1;
      }

      await db
        .update(generationHistory)
        .set({
          status: transition.status,
          output: nextOutput,
          error: transition.error ?? FINAL_QUALITY_TIMEOUT_MESSAGE,
        })
        .where(eq(generationHistory.id, row.id));

      processedCount += 1;
      if (transition.status === 'failed') {
        failedCount += 1;
      } else {
        succeededCount += 1;
      }
    } catch (error) {
      errorCount += 1;
      console.error('cleanupStaleGenerations error:', row.id, error);
    }
  }

  return {
    scannedCount: rows.length,
    processedCount,
    failedCount,
    succeededCount,
    releasedCount,
    refundedCount,
    errorCount,
  };
}
