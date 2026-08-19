import { refundCredits } from '@/core/workspace-credits/credits';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { generationHistory } from '@/config/db/schema';
import { getEffectById } from '@/core/effects/effects';
import {
  resolveProviderSyncTransition,
  resolveProviderTaskId,
  resolveTimeoutTransition,
  withBaseResultUrl,
  withFallbackFromBase,
} from '@/core/effects/generation-orchestrator';
import { createAdapter } from '@/core/adapters/adapter-factory';
import {
  didOutputStorageSyncFail,
  OUTPUT_STORAGE_SYNC_RETRY_ERROR,
  persistEffectOutputIfNeeded,
} from '@/core/effects/output-storage';
import {
  getGenerationById,
  updateGenerationById,
} from '@/core/effects/record-generation';
import {
  EFFECTS_GENERATION_TIMEOUT_MS,
  EFFECTS_POLL_INTERVAL_MS,
} from '@/core/effects/runtime-config';
import { persistVideoOutputIfNeeded } from '@/core/effects/video-storage';
import { and, asc, inArray, isNull, lt, or } from 'drizzle-orm';

const runningPollers = new Set<string>();

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isTerminalStatus = (status: string) =>
  status === 'succeeded' || status === 'failed';

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const getRequestedQuality = (input: unknown, provider: string) => {
  if (provider !== 'veo3.1') return null;
  const inputObject = asObject(input);
  const quality = inputObject.wmOutputQuality;
  return quality === '1080p' || quality === '4k' ? quality : null;
};

const readString = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

const isQualityFinalized = (output: Record<string, unknown>) =>
  output.quality_finalized === true;

const shouldContinueAfterSuccess = ({
  status,
  requestedQuality,
  output,
}: {
  status: string;
  requestedQuality: '1080p' | '4k' | null;
  output: Record<string, unknown>;
}) => {
  if (status !== 'succeeded') return false;
  if (!requestedQuality) return false;
  return !isQualityFinalized(output);
};

const tryRefundIfNeeded = async ({
  wmTaskId,
  userId,
  creditsUsed,
  output,
  error,
}: {
  wmTaskId: string;
  userId: string;
  creditsUsed: number;
  output: Record<string, unknown>;
  error: string | null;
}) => {
  if (creditsUsed <= 0 || output.creditsRefunded === true) {
    return;
  }

  await refundCredits({
    userId,
    amount: creditsUsed,
    description: 'Refund for failed generation',
    referenceId: wmTaskId,
  });
  await updateGenerationById({
    id: wmTaskId,
    status: 'failed',
    output: { ...output, creditsRefunded: true, wmTaskId },
    error,
  });
};

type GenerationStatusPassResult = {
  shouldRetry: boolean;
  retryAfterMs: number;
};

export type DueGenerationStatusPassResult = {
  scanned: number;
  processed: number;
  retrying: number;
  completed: number;
};

export const runGenerationStatusPass = async ({
  wmTaskId,
  userId,
  effectId,
}: {
  wmTaskId: string;
  userId: string;
  effectId: number;
}): Promise<GenerationStatusPassResult> => {
  const effect = await getEffectById(effectId);
  if (!effect) {
    return { shouldRetry: false, retryAfterMs: 0 };
  }

  const generation = await getGenerationById({
    id: wmTaskId,
    userId,
    effectId,
  });
  if (!generation) {
    return { shouldRetry: false, retryAfterMs: 0 };
  }

  const requestedQuality = getRequestedQuality(
    generation.input,
    effect.provider
  );
  const generationOutput = asObject(generation.output);
  const adapter = createAdapter(effect);
  if (!adapter.checkStatus) {
    return { shouldRetry: false, retryAfterMs: 0 };
  }

  const isTimeoutExceeded =
    Date.now() - new Date(generation.createdAt).getTime() >=
    EFFECTS_GENERATION_TIMEOUT_MS;
  if (isTimeoutExceeded && !isTerminalStatus(generation.status)) {
    const timeoutTransition = resolveTimeoutTransition({
      generationId: wmTaskId,
      output: generation.output,
    });
    const timeoutOutput = asObject(timeoutTransition.output);
    await updateGenerationById({
      id: wmTaskId,
      status: timeoutTransition.publicStatus,
      output: timeoutTransition.output,
      error: timeoutTransition.error,
    });
    if (timeoutTransition.publicStatus === 'failed') {
      await tryRefundIfNeeded({
        wmTaskId,
        userId,
        creditsUsed: generation.creditsUsed,
        output: timeoutOutput,
        error: timeoutTransition.error,
      });
    }
    return { shouldRetry: false, retryAfterMs: 0 };
  }

  if (
    isTerminalStatus(generation.status) &&
    !shouldContinueAfterSuccess({
      status: generation.status,
      requestedQuality,
      output: generationOutput,
    })
  ) {
    return { shouldRetry: false, retryAfterMs: 0 };
  }

  const providerTaskId =
    typeof generation.providerTaskId === 'string'
      ? generation.providerTaskId
      : typeof generationOutput.providerTaskId === 'string'
        ? generationOutput.providerTaskId
        : typeof generationOutput.taskId === 'string'
          ? generationOutput.taskId
          : null;
  if (!providerTaskId) {
    return { shouldRetry: true, retryAfterMs: EFFECTS_POLL_INTERVAL_MS };
  }

  const inHighQualityFinalization =
    requestedQuality !== null &&
    readString(generationOutput.base_result_url) !== null &&
    !isQualityFinalized(generationOutput);

  if (inHighQualityFinalization && requestedQuality === '1080p') {
    if (!adapter.get1080pVideo) {
      await updateGenerationById({
        id: wmTaskId,
        status: 'succeeded',
        output: withFallbackFromBase(generationOutput),
        error: null,
      });
      return { shouldRetry: false, retryAfterMs: 0 };
    }

    const result1080 = await adapter.get1080pVideo(providerTaskId, 0);
    if (result1080.status === 'processing' || result1080.status === 'pending') {
      await updateGenerationById({
        id: wmTaskId,
        status: 'processing',
        output: { ...generationOutput, quality_finalized: false },
        error: null,
      });
      return { shouldRetry: true, retryAfterMs: EFFECTS_POLL_INTERVAL_MS };
    }

    if (result1080.status === 'failed') {
      await updateGenerationById({
        id: wmTaskId,
        status: 'succeeded',
        output: withFallbackFromBase(generationOutput),
        error:
          result1080.error ??
          '1080P not ready, delivered base-quality fallback.',
      });
      return { shouldRetry: false, retryAfterMs: 0 };
    }

    const output1080Base =
      result1080.output && typeof result1080.output === 'object'
        ? {
            ...generationOutput,
            ...(result1080.output as Record<string, unknown>),
            wmTaskId,
            providerTaskId,
            taskId: providerTaskId,
          }
        : {
            ...generationOutput,
            wmTaskId,
            providerTaskId,
            taskId: providerTaskId,
          };
    const persisted1080 =
      effect.type === 1
        ? await persistVideoOutputIfNeeded({
            output: output1080Base,
            wmTaskId,
            effectId,
            userId,
          })
        : output1080Base;
    await updateGenerationById({
      id: wmTaskId,
      status: 'succeeded',
      output: {
        ...(persisted1080 as Record<string, unknown>),
        quality_finalized: true,
      },
      error: null,
    });
    return { shouldRetry: false, retryAfterMs: 0 };
  }

  if (inHighQualityFinalization && requestedQuality === '4k') {
    const hasFinalTask =
      typeof generationOutput.parentTaskId === 'string' &&
      generationOutput.parentTaskId.length > 0;

    if (!hasFinalTask) {
      if (!adapter.get4kVideo) {
        await updateGenerationById({
          id: wmTaskId,
          status: 'succeeded',
          output: withFallbackFromBase(generationOutput),
          error: null,
        });
        return { shouldRetry: false, retryAfterMs: 0 };
      }

      const fourKResult = await adapter.get4kVideo(providerTaskId, 0);
      if (fourKResult.status === 'failed') {
        await updateGenerationById({
          id: wmTaskId,
          status: 'succeeded',
          output: withFallbackFromBase(generationOutput),
          error:
            fourKResult.error ??
            '4K not ready, delivered base-quality fallback.',
        });
        return { shouldRetry: false, retryAfterMs: 0 };
      }

      const fourKOutput =
        fourKResult.output && typeof fourKResult.output === 'object'
          ? {
              ...generationOutput,
              ...(fourKResult.output as Record<string, unknown>),
              wmTaskId,
              providerTaskId:
                typeof (fourKResult.output as Record<string, unknown>)
                  .taskId === 'string'
                  ? ((fourKResult.output as Record<string, unknown>)
                      .taskId as string)
                  : providerTaskId,
              taskId:
                typeof (fourKResult.output as Record<string, unknown>)
                  .taskId === 'string'
                  ? ((fourKResult.output as Record<string, unknown>)
                      .taskId as string)
                  : providerTaskId,
              quality_finalized: false,
            }
          : {
              ...generationOutput,
              wmTaskId,
              providerTaskId,
              taskId: providerTaskId,
              quality_finalized: false,
            };

      if (fourKResult.status === 'succeeded') {
        const persisted4k =
          effect.type === 1
            ? await persistVideoOutputIfNeeded({
                output: fourKOutput,
                wmTaskId,
                effectId,
                userId,
              })
            : fourKOutput;
        await updateGenerationById({
          id: wmTaskId,
          status: 'succeeded',
          output: {
            ...(persisted4k as Record<string, unknown>),
            quality_finalized: true,
          },
          error: null,
        });
        return { shouldRetry: false, retryAfterMs: 0 };
      }

      await updateGenerationById({
        id: wmTaskId,
        status: 'processing',
        output: fourKOutput,
        error: null,
      });
      return { shouldRetry: true, retryAfterMs: EFFECTS_POLL_INTERVAL_MS };
    }
  }

  const result = await adapter.checkStatus(providerTaskId);
  let providerStatus = result.status;
  let providerOutput = result.output;
  let providerError = result.error ?? null;
  let providerTaskIdForTransition = providerTaskId;
  let transition = resolveProviderSyncTransition({
    generationId: wmTaskId,
    previousOutput: {
      ...generationOutput,
      creditsRefunded: generationOutput.creditsRefunded === true,
    },
    providerStatus,
    providerTaskId: providerTaskIdForTransition,
    providerOutput,
    providerError,
    requestedQuality,
  });

  let outputForStore =
    providerStatus === 'succeeded'
      ? await persistEffectOutputIfNeeded({
          output: transition.output,
          wmTaskId,
          effectId,
          effectType: effect.type,
          userId,
        })
      : transition.output;
  const storageSyncFailed = didOutputStorageSyncFail(outputForStore);

  if (providerStatus === 'succeeded' && storageSyncFailed) {
    await updateGenerationById({
      id: wmTaskId,
      status: 'processing',
      output: outputForStore,
      error: OUTPUT_STORAGE_SYNC_RETRY_ERROR,
    });
    return { shouldRetry: true, retryAfterMs: EFFECTS_POLL_INTERVAL_MS };
  }

  if (providerStatus === 'succeeded') {
    outputForStore = withBaseResultUrl(
      outputForStore as Record<string, unknown>
    );
  }

  if (
    transition.publicStatus === 'succeeded' &&
    requestedQuality &&
    !isQualityFinalized(outputForStore as Record<string, unknown>)
  ) {
    await updateGenerationById({
      id: wmTaskId,
      status: 'processing',
      output: {
        ...(outputForStore as Record<string, unknown>),
        quality_finalized: false,
      },
      error: null,
    });
    return { shouldRetry: true, retryAfterMs: EFFECTS_POLL_INTERVAL_MS };
  }

  await updateGenerationById({
    id: wmTaskId,
    status: transition.publicStatus,
    output: outputForStore,
    error: transition.error,
  });

  if (transition.publicStatus === 'failed') {
    await tryRefundIfNeeded({
      wmTaskId,
      userId,
      creditsUsed: generation.creditsUsed,
      output: outputForStore as Record<string, unknown>,
      error: transition.error,
    });
    return { shouldRetry: false, retryAfterMs: 0 };
  }

  if (transition.publicStatus === 'succeeded') {
    return { shouldRetry: false, retryAfterMs: 0 };
  }

    return { shouldRetry: true, retryAfterMs: EFFECTS_POLL_INTERVAL_MS };
};

export const runDueGenerationStatusPasses = async ({
  limit = 10,
  staleBefore = new Date(Date.now() - EFFECTS_POLL_INTERVAL_MS),
}: {
  limit?: number;
  staleBefore?: Date;
} = {}): Promise<DueGenerationStatusPassResult> => {
  const db = await getDb();
  const rows = await db
    .select({
      id: generationHistory.id,
      userId: generationHistory.userId,
      effectId: generationHistory.effectId,
    })
    .from(generationHistory)
    .where(
      and(
        inArray(generationHistory.status, ['pending', 'processing']),
        or(
          isNull(generationHistory.lastProviderSyncAt),
          lt(generationHistory.lastProviderSyncAt, staleBefore)
        )
      )
    )
    .orderBy(asc(generationHistory.createdAt))
    .limit(Math.max(1, Math.min(limit, 25)));

  let retrying = 0;
  let completed = 0;
  for (const row of rows) {
    const result = await runGenerationStatusPass({
      wmTaskId: row.id,
      userId: row.userId,
      effectId: row.effectId,
    });
    if (result.shouldRetry) {
      retrying += 1;
    } else {
      completed += 1;
    }
  }

  return {
    scanned: rows.length,
    processed: rows.length,
    retrying,
    completed,
  };
};

export const startBackendPollingForGeneration = ({
  wmTaskId,
  userId,
  effectId,
}: {
  wmTaskId: string;
  userId: string;
  effectId: number;
}) => {
  if (runningPollers.has(wmTaskId)) {
    return;
  }

  runningPollers.add(wmTaskId);

  void (async () => {
    try {
      while (true) {
        const result = await runGenerationStatusPass({
          wmTaskId,
          userId,
          effectId,
        });
        if (!result.shouldRetry) {
          return;
        }
        await sleep(result.retryAfterMs);
      }
    } catch (error) {
      console.error('startBackendPollingForGeneration error:', error);
    } finally {
      runningPollers.delete(wmTaskId);
    }
  })();
};
