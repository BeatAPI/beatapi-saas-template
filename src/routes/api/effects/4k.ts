import { refundCredits } from '@/core/workspace-credits/credits';
import { createAdapter } from '@/core/adapters/adapter-factory';
import { getEffectById } from '@/core/effects/effects';
import {
  getGenerationById,
  updateGenerationById,
} from '@/core/effects/record-generation';
import { persistVideoOutputIfNeeded } from '@/core/effects/video-storage';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import { requireSession } from '@/core/workspace-lib/require-session';
import { createFileRoute } from '@tanstack/react-router';

type FourKRequest = {
  wmTaskId?: string;
  effectId?: number;
  index?: number;
};

async function POST({ request }: { request: Request }) {
  const session = await requireSession(request);
  const resolvedUser = await resolveRequestUser(request, session?.user.id);
  if (!resolvedUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId } = resolvedUser;

  let payload: FourKRequest | null = null;
  try {
    payload = (await request.json()) as FourKRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload?.wmTaskId || !Number.isFinite(payload.effectId)) {
    return Response.json(
      { error: 'wmTaskId and effectId are required' },
      { status: 400 }
    );
  }

  const effect = await getEffectById(payload.effectId as number);
  if (!effect) {
    return Response.json({ error: 'Effect not found' }, { status: 404 });
  }

  const adapter = createAdapter(effect);
  if (!adapter.get4kVideo) {
    return Response.json(
      { error: '4k fetch not supported for this effect' },
      { status: 400 }
    );
  }

  const index = Number.isFinite(payload.index) ? Number(payload.index) : 0;
  const generation = await getGenerationById({
    id: payload.wmTaskId,
    userId,
    effectId: effect.id,
  });
  if (!generation) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }
  const generationOutput =
    generation.output && typeof generation.output === 'object'
      ? (generation.output as Record<string, unknown>)
      : {};
  const providerTaskId =
    typeof generation.providerTaskId === 'string'
      ? generation.providerTaskId
      : typeof generationOutput.providerTaskId === 'string'
        ? generationOutput.providerTaskId
        : typeof generationOutput.taskId === 'string'
          ? generationOutput.taskId
          : null;
  if (!providerTaskId) {
    return Response.json(
      { error: 'Provider task is not ready yet' },
      { status: 409 }
    );
  }

  const result = await adapter.get4kVideo(providerTaskId, index);

  const nextProviderTaskId =
    result.output && typeof result.output === 'object'
      ? typeof (result.output as Record<string, unknown>).taskId === 'string'
        ? ((result.output as Record<string, unknown>).taskId as string)
        : providerTaskId
      : providerTaskId;

  const normalizedOutput =
    result.output && typeof result.output === 'object'
      ? {
          ...generationOutput,
          ...(result.output as Record<string, unknown>),
          wmTaskId: payload.wmTaskId,
          providerTaskId: nextProviderTaskId,
          taskId: nextProviderTaskId,
        }
      : {
          ...generationOutput,
          wmTaskId: payload.wmTaskId,
          providerTaskId: nextProviderTaskId,
          taskId: nextProviderTaskId,
        };
  const outputForStore =
    result.status === 'succeeded'
      ? await persistVideoOutputIfNeeded({
          output: normalizedOutput,
          wmTaskId: payload.wmTaskId,
          effectId: effect.id,
          userId: generation.userId,
        })
      : normalizedOutput;

  const baseResultUrl =
    typeof generationOutput.base_result_url === 'string' &&
    generationOutput.base_result_url
      ? generationOutput.base_result_url
      : null;
  const finalStatus =
    result.status === 'failed' && baseResultUrl ? 'succeeded' : result.status;
  const finalOutput =
    finalStatus === 'succeeded' && result.status === 'failed' && baseResultUrl
      ? {
          ...generationOutput,
          result_url: baseResultUrl,
          quality_finalized: true,
          wmTaskId: payload.wmTaskId,
        }
      : result.status === 'succeeded'
        ? {
            ...(outputForStore as Record<string, unknown>),
            quality_finalized: true,
          }
        : {
            ...(outputForStore as Record<string, unknown>),
            quality_finalized: false,
          };

  await updateGenerationById({
    id: payload.wmTaskId,
    status: finalStatus,
    output: finalOutput,
    error:
      result.status === 'failed' && baseResultUrl
        ? '4K task failed, delivered base-quality fallback.'
        : (result.error ?? null),
  });

  if (
    finalStatus === 'failed' &&
    generation.creditsUsed > 0 &&
    generationOutput.creditsRefunded !== true
  ) {
    await refundCredits({
      userId,
      amount: generation.creditsUsed,
      description: 'Refund for failed generation',
      referenceId: payload.wmTaskId,
    });
    await updateGenerationById({
      id: payload.wmTaskId,
      status: 'failed',
      output: {
        ...(finalOutput as Record<string, unknown>),
        creditsRefunded: true,
      },
      error: result.error ?? null,
    });
  }

  return Response.json({
    success: finalStatus === 'succeeded',
    wmTaskId: payload.wmTaskId,
    status: finalStatus,
    output: finalOutput,
    error: finalStatus === 'failed' ? '4K task failed, please retry.' : null,
  });
}

export const Route = createFileRoute('/api/effects/4k')({
  server: {
    handlers: { POST },
  },
});
