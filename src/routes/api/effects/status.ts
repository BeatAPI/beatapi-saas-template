import { refundCredits } from '@/core/workspace-credits/credits';
import { createAdapter } from '@/core/adapters/adapter-factory';
import { getEffectById } from '@/core/effects/effects';
import {
  resolveProviderSyncTransition,
  resolveTimeoutTransition,
} from '@/core/effects/generation-orchestrator';
import {
  didOutputStorageSyncFail,
  OUTPUT_STORAGE_SYNC_RETRY_ERROR,
  persistEffectOutputIfNeeded,
  shouldRetryOutputStorageSync,
} from '@/core/effects/output-storage';
import { enqueueEffectsStatusCheck } from '@/core/effects/queue';
import {
  getGenerationById,
  updateGenerationById,
} from '@/core/effects/record-generation';
import { EFFECTS_GENERATION_TIMEOUT_MS } from '@/core/effects/runtime-config';
import { startBackendPollingForGeneration } from '@/core/effects/server-poller';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import { requireSession } from '@/core/workspace-lib/require-session';
import { createFileRoute } from '@tanstack/react-router';

const isTerminalStatus = (status: string) =>
  status === 'succeeded' || status === 'failed';

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const getRequestedQuality = (input: unknown, provider?: string) => {
  if (provider !== 'veo3.1') return null;
  const inputObject = asObject(input);
  const quality = inputObject.wmOutputQuality;
  return quality === '1080p' || quality === '4k' ? quality : null;
};

const readProviderStatusOnce = async ({
  providerTaskId,
  effectId,
  wmTaskId,
  userId,
  generationOutput,
  requestedQuality,
}: {
  providerTaskId: string;
  effectId: number;
  wmTaskId: string;
  userId: string;
  generationOutput: Record<string, unknown>;
  requestedQuality: '1080p' | '4k' | null;
}) => {
  const effect = await getEffectById(effectId);
  if (!effect) {
    return { ok: false as const, statusCode: 404, error: 'Effect not found' };
  }
  const adapter = createAdapter(effect);
  if (!adapter.checkStatus) {
    return {
      ok: false as const,
      statusCode: 400,
      error: 'Status check not supported for this effect',
    };
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

  const outputForStore =
    providerStatus === 'succeeded'
      ? await persistEffectOutputIfNeeded({
          output: transition.output,
          wmTaskId,
          effectId,
          effectType: effect.type,
          userId,
        })
      : transition.output;
  const storageSyncFailed = shouldRetryOutputStorageSync({
    providerStatus,
    output: outputForStore,
  });

  return {
    ok: true as const,
    internalStatus: storageSyncFailed ? 'processing' : transition.status,
    publicStatus: storageSyncFailed ? 'processing' : transition.publicStatus,
    outputForStore,
    error: storageSyncFailed
      ? OUTPUT_STORAGE_SYNC_RETRY_ERROR
      : transition.error,
    shouldRetryStorageSync: storageSyncFailed,
  };
};

async function GET({ request }: { request: Request }) {
  const session = await requireSession(request);
  const resolvedUser = await resolveRequestUser(request, session?.user.id);
  if (!resolvedUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId } = resolvedUser;

  const { searchParams } = new URL(request.url);
  const wmTaskId = searchParams.get('wmTaskId');
  const effectIdParam = searchParams.get('effectId');
  const syncProvider = searchParams.get('syncProvider') === '1';

  if (!wmTaskId || !effectIdParam) {
    return Response.json(
      { error: 'Missing wmTaskId or effectId' },
      { status: 400 }
    );
  }

  const effectId = Number.parseInt(effectIdParam, 10);
  if (Number.isNaN(effectId)) {
    return Response.json({ error: 'Invalid effectId' }, { status: 400 });
  }

  const generation = await getGenerationById({
    id: wmTaskId,
    userId,
    effectId,
  });
  if (!generation) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  const effect = await getEffectById(effectId);
  if (!effect) {
    return Response.json({ error: 'Effect not found' }, { status: 404 });
  }

  const generationOutput = asObject(generation.output);
  const requestedQuality = getRequestedQuality(
    generation.input,
    effect.provider
  );
  const providerTaskId =
    typeof generation.providerTaskId === 'string'
      ? generation.providerTaskId
      : typeof generationOutput.providerTaskId === 'string'
        ? generationOutput.providerTaskId
        : typeof generationOutput.taskId === 'string'
          ? generationOutput.taskId
          : null;
  try {
    const isTimeoutExceeded =
      Date.now() - new Date(generation.createdAt).getTime() >=
      EFFECTS_GENERATION_TIMEOUT_MS;
    if (
      isTimeoutExceeded &&
      !isTerminalStatus(generation.status) &&
      generation.creditsUsed > 0
    ) {
      const timeoutTransition = resolveTimeoutTransition({
        generationId: wmTaskId,
        output: generationOutput,
      });
      if (timeoutTransition.publicStatus === 'succeeded') {
        await updateGenerationById({
          id: wmTaskId,
          status: timeoutTransition.publicStatus,
          output: timeoutTransition.output,
          error: timeoutTransition.error,
        });
        return Response.json({
          success: true,
          wmTaskId,
          status: timeoutTransition.publicStatus,
          output: timeoutTransition.output,
          error: null,
        });
      }

      if (generationOutput.creditsRefunded === true) {
        return Response.json({
          success: true,
          wmTaskId,
          status: 'failed',
          output: generationOutput,
          error: 'Generation failed, please retry.',
        });
      }

      await refundCredits({
        userId,
        amount: generation.creditsUsed,
        description: 'Refund for failed generation',
        referenceId: wmTaskId,
      });
      await updateGenerationById({
        id: wmTaskId,
        status: timeoutTransition.publicStatus,
        output: {
          ...generationOutput,
          creditsRefunded: true,
          wmTaskId,
          providerTaskId,
          taskId: providerTaskId,
          lifecyclePhase: timeoutTransition.status,
        },
        error: timeoutTransition.error,
      });
      return Response.json({
        success: true,
        wmTaskId,
        status: 'failed',
        output: {
          ...generationOutput,
          creditsRefunded: true,
          wmTaskId,
          providerTaskId,
          taskId: providerTaskId,
        },
        error: 'Generation failed, please retry.',
      });
    }

    if (
      !syncProvider ||
      (isTerminalStatus(generation.status) &&
        !didOutputStorageSyncFail(generationOutput)) ||
      !providerTaskId
    ) {
      return Response.json({
        success: true,
        wmTaskId,
        status: generation.status,
        output: generation.output,
        error:
          generation.status === 'failed'
            ? 'Generation failed, please retry.'
            : null,
      });
    }

    const providerResult = await readProviderStatusOnce({
      providerTaskId,
      effectId,
      wmTaskId,
      userId: generation.userId,
      generationOutput,
      requestedQuality,
    });
    if (!providerResult.ok) {
      return Response.json(
        { error: providerResult.error },
        { status: providerResult.statusCode }
      );
    }

    await updateGenerationById({
      id: wmTaskId,
      status: providerResult.publicStatus,
      output: providerResult.outputForStore,
      error: providerResult.error,
    });

    if (providerResult.shouldRetryStorageSync) {
      const enqueueResult = await enqueueEffectsStatusCheck({
        wmTaskId,
        userId: generation.userId,
        effectId,
        attempt: 0,
        source: 'retry',
      });
      if (!enqueueResult.enqueued) {
        startBackendPollingForGeneration({
          wmTaskId,
          userId: generation.userId,
          effectId,
        });
      }
    }

    if (
      providerResult.publicStatus === 'failed' &&
      generation.creditsUsed > 0 &&
      generationOutput.creditsRefunded !== true
    ) {
      await refundCredits({
        userId,
        amount: generation.creditsUsed,
        description: 'Refund for failed generation',
        referenceId: wmTaskId,
      });
      await updateGenerationById({
        id: wmTaskId,
        status: 'failed',
        output: {
          ...(providerResult.outputForStore as Record<string, unknown>),
          creditsRefunded: true,
          wmTaskId,
        },
        error: providerResult.error,
      });
    }

    const responseStatus = providerResult.publicStatus;

    return Response.json({
      success: true,
      wmTaskId,
      status: responseStatus,
      output: providerResult.outputForStore,
      error:
        responseStatus === 'failed' ? 'Generation failed, please retry.' : null,
    });
  } catch (error) {
    console.error('effects.status error:', error);
    return Response.json(
      { error: 'Failed to query task status, please retry.' },
      { status: 500 }
    );
  }
}

export const Route = createFileRoute('/api/effects/status')({
  server: {
    handlers: { GET },
  },
});
