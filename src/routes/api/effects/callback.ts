import { createHmac, timingSafeEqual } from 'crypto';
import { refundCredits } from '@/core/workspace-credits/credits';
import type { GenerationResult } from '@/core/adapters/base-adapter';
import { getEffectById } from '@/core/effects/effects';
import {
  resolveProviderSyncTransition,
  withFallbackFromBase,
} from '@/core/effects/generation-orchestrator';

import { resolveOutputMedia } from '@/core/effects/output-media';
import {
  didOutputStorageSyncFail,
  OUTPUT_STORAGE_SYNC_RETRY_ERROR,
  persistEffectOutputIfNeeded,
} from '@/core/effects/output-storage';
import {
  extractProviderCallbackTaskId,
  resolveEffectCallbackKind,
  resolveProviderCallbackError,
  resolveProviderCallbackPayloadData,
  resolveProviderCallbackStatus,
  verifyViduCallbackSignature,
} from '@/core/effects/provider-callback';
import { consumeProviderCallbackNonce } from '@/core/effects/provider-callback-nonce';
import { enqueueEffectsStatusCheck } from '@/core/effects/queue';
import {
  getGenerationByProviderTaskIdGlobal,
  updateGenerationById,
} from '@/core/effects/record-generation';
import { isEffectsGenerationTimeoutError } from '@/core/effects/runtime-config';
import { startBackendPollingForGeneration } from '@/core/effects/server-poller';
import { createFileRoute } from '@tanstack/react-router';

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

const getRequestedQuality = (input: unknown, provider?: string) => {
  if (provider !== 'veo3.1') return null;
  const inputObject = asObject(input);
  const quality = inputObject.wmOutputQuality;
  return quality === '1080p' || quality === '4k' ? quality : null;
};

const isTerminalGenerationStatus = (status: string | null | undefined) =>
  status === 'succeeded' || status === 'failed';

const verifyKieCallbackSignature = ({
  request,
  providerTaskId,
}: {
  request: Request;
  providerTaskId: string;
}) => {
  const signingKey = process.env.KIE_WEBHOOK_SECRET;
  if (!signingKey) {
    console.error('KIE callback signature key is missing');
    return {
      ok: false,
      status: 500,
      error: 'Server webhook key not configured',
    };
  }

  const timestamp = request.headers.get('X-Webhook-Timestamp');
  const signature = request.headers
    .get('X-Webhook-Signature')
    ?.replace(/^sha256=/i, '')
    .trim();

  if (!timestamp || !signature) {
    return {
      ok: false,
      status: 401,
      error: 'Missing callback signature headers',
    };
  }

  const timestampValue = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampValue)) {
    return { ok: false, status: 401, error: 'Invalid callback timestamp' };
  }

  const timestampSeconds =
    timestampValue > 1_000_000_000_000
      ? Math.floor(timestampValue / 1000)
      : timestampValue;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const toleranceSeconds = Number.parseInt(
    process.env.KIE_WEBHOOK_TOLERANCE_SECONDS || '300',
    10
  );

  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    return { ok: false, status: 401, error: 'Callback timestamp expired' };
  }

  const signedContent = `${providerTaskId}.${timestamp}`;
  const expectedSignature = createHmac('sha256', signingKey)
    .update(signedContent)
    .digest('base64');

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return { ok: false, status: 401, error: 'Invalid callback signature' };
  }

  return { ok: true } as const;
};

async function POST({ request }: { request: Request }) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const taskId = extractProviderCallbackTaskId(payload);
  if (!taskId) {
    return Response.json({ error: 'Missing taskId' }, { status: 400 });
  }

  const generation = await getGenerationByProviderTaskIdGlobal({ taskId });
  if (
    generation?.status === 'failed' &&
    isEffectsGenerationTimeoutError(generation.error)
  ) {
    return Response.json({
      success: true,
      status: 'ignored',
      taskId,
    });
  }
  const generationEffect = generation
    ? await getEffectById(generation.effectId)
    : null;
  const generationOutput = generation ? asObject(generation.output) : {};
  const callbackProvider = generationEffect?.provider ?? null;
  const callbackKind = resolveEffectCallbackKind(callbackProvider);
  if (callbackKind === 'kie') {
    const signatureValidation = verifyKieCallbackSignature({
      request,
      providerTaskId: taskId,
    });
    if (!signatureValidation.ok) {
      return Response.json(
        { error: signatureValidation.error },
        { status: signatureValidation.status }
      );
    }
  }
  if (callbackKind === 'vidu') {
    const requestUrl = new URL(request.url);
    const signatureValidation = verifyViduCallbackSignature({
      method: request.method,
      callbackUri: requestUrl.pathname,
      rawQueryString: requestUrl.search.replace(/^\?/, ''),
      headers: request.headers,
      secret: process.env.VIDU_CALLBACK_SECRET,
    });
    if (!signatureValidation.ok) {
      return Response.json(
        { error: signatureValidation.error },
        { status: signatureValidation.status }
      );
    }

    const nonceResult = await consumeProviderCallbackNonce({
      provider: 'vidu',
      nonce: signatureValidation.nonce,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    if (!nonceResult.ok) {
      if (nonceResult.status === 409) {
        return Response.json({
          success: true,
          status: 'ignored',
          taskId,
        });
      }
      return Response.json(
        { error: nonceResult.error },
        { status: nonceResult.status }
      );
    }
  }

  const status = resolveProviderCallbackStatus({
    provider: callbackProvider,
    payload,
  });
  if (generation && isTerminalGenerationStatus(generation.status)) {
    return Response.json({
      success: true,
      status: 'ignored',
      taskId,
    });
  }
  const callbackError = resolveProviderCallbackError({
    provider: callbackProvider,
    payload,
  });
  const callbackData = resolveProviderCallbackPayloadData({
    provider: callbackProvider,
    payload,
  });
  const mediaOutput = resolveOutputMedia(callbackData);
  const resultUrls =
    mediaOutput.resultUrls.length > 0
      ? mediaOutput.resultUrls
      : mediaOutput.videoUrls;
  const resultUrl = mediaOutput.resultUrl;
  const coverUrl = mediaOutput.coverUrl;
  const inferredAssetType = generationEffect?.type === 2 ? 'image' : 'video';
  const outputBase =
    status === 'succeeded'
      ? {
          ...(inferredAssetType === 'video' ? { video_urls: resultUrls } : {}),
          ...(inferredAssetType === 'image' ? { image_urls: resultUrls } : {}),
          ...(coverUrl
            ? { cover_url: coverUrl, provider_cover_url: coverUrl }
            : {}),
          result_urls: resultUrls,
          result_url: resultUrl ?? resultUrls[0],
          raw: callbackData,
        }
      : {
          raw: callbackData,
        };
  const requestedQuality = generation
    ? getRequestedQuality(generation.input, callbackProvider ?? undefined)
    : null;
  let providerStatus: GenerationResult['status'] = status;
  let providerError = callbackError;
  let providerTaskIdForTransition = taskId;
  let transition = generation
    ? resolveProviderSyncTransition({
        generationId: generation.id,
        previousOutput: generationOutput,
        providerStatus,
        providerTaskId: providerTaskIdForTransition,
        providerOutput: outputBase,
        providerError,
        requestedQuality,
      })
    : null;

  let output =
    generation && providerStatus === 'succeeded' && generationEffect && transition
      ? await persistEffectOutputIfNeeded({
          output: transition.output,
          wmTaskId: generation.id,
          effectId: generation.effectId,
          effectType: generationEffect.type,
          userId: generation.userId,
        })
      : (transition?.output ?? outputBase);



  const storageSyncFailed = didOutputStorageSyncFail(output);

  const baseTaskId = readString(generationOutput.parentTaskId);
  const isBaseTaskCallback =
    requestedQuality === '4k' && baseTaskId ? baseTaskId === taskId : true;
  const shouldHoldForFinalQuality =
    providerStatus === 'succeeded' &&
    generation &&
    requestedQuality !== null &&
    generationOutput.quality_finalized !== true &&
    isBaseTaskCallback;

  if (generation) {
    const nextStatus =
      storageSyncFailed && providerStatus === 'succeeded'
        ? 'processing'
        : shouldHoldForFinalQuality && transition
          ? transition.publicStatus
          : (transition?.publicStatus ?? status);
    await updateGenerationById({
      id: generation.id,
      status: nextStatus,
      output,
      error:
        storageSyncFailed && providerStatus === 'succeeded'
          ? OUTPUT_STORAGE_SYNC_RETRY_ERROR
          : nextStatus === 'failed'
            ? providerError || 'Callback reported failure'
            : null,
    });

    if (nextStatus === 'processing') {
      const enqueueResult = await enqueueEffectsStatusCheck({
        wmTaskId: generation.id,
        userId: generation.userId,
        effectId: generation.effectId,
        attempt: 0,
        source: 'callback',
      });
      if (!enqueueResult.enqueued) {
        startBackendPollingForGeneration({
          wmTaskId: generation.id,
          userId: generation.userId,
          effectId: generation.effectId,
        });
      }
    }
  }

  if (providerStatus === 'failed') {
    if (
      generation &&
      generation.status !== 'succeeded' &&
      generation.creditsUsed > 0
    ) {
      if (readString(generationOutput.base_result_url)) {
        await updateGenerationById({
          id: generation.id,
          status: 'succeeded',
          output: withFallbackFromBase(generationOutput),
          error: 'Final-quality task failed, delivered base-quality fallback.',
        });
        return Response.json({
          success: true,
          status: 'succeeded',
          taskId,
        });
      }
      if (generationOutput.creditsRefunded !== true) {
        await refundCredits({
          userId: generation.userId,
          amount: generation.creditsUsed,
          description: 'Refund for failed generation',
          referenceId: generation.id,
        });
        await updateGenerationById({
          id: generation.id,
          status: 'failed',
          output: {
            ...generationOutput,
            creditsRefunded: true,
            wmTaskId: generation.id,
          },
          error: providerError || 'Callback reported failure',
        });
      }
    }
  }

  return Response.json({
    success: true,
    status: transition?.publicStatus ?? status,
    taskId,
  });
}

export const Route = createFileRoute('/api/effects/callback')({
  server: {
    handlers: { POST },
  },
});
