import { createFileRoute } from '@tanstack/react-router';
import { createAdapter } from '@/core/adapters/adapter-factory';
import { getEffectById } from '@/core/effects/effects';
import {
  getGenerationById,
  updateGenerationById,
} from '@/core/effects/record-generation';
import { persistVideoOutputIfNeeded } from '@/core/effects/video-storage';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import { requireSession } from '@/core/workspace-lib/require-session';

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
  const indexParam = searchParams.get('index') ?? '0';

  if (!wmTaskId || !effectIdParam) {
    return Response.json(
      { error: 'Missing wmTaskId or effectId' },
      { status: 400 }
    );
  }

  const effectId = Number.parseInt(effectIdParam, 10);
  const index = Number.parseInt(indexParam, 10);
  if (Number.isNaN(effectId) || Number.isNaN(index) || index < 0) {
    return Response.json(
      { error: 'Invalid effectId or index' },
      { status: 400 }
    );
  }

  const effect = await getEffectById(effectId);
  if (!effect) {
    return Response.json({ error: 'Effect not found' }, { status: 404 });
  }

  const generation = await getGenerationById({
    id: wmTaskId,
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

  const adapter = createAdapter(effect);
  if (!adapter.get1080pVideo) {
    return Response.json(
      { error: '1080p fetch not supported for this effect' },
      { status: 400 }
    );
  }

  const result = await adapter.get1080pVideo(providerTaskId, index);
  const normalizedOutput =
    result.output && typeof result.output === 'object'
      ? {
          ...generationOutput,
          ...(result.output as Record<string, unknown>),
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
  const outputForStore =
    result.status === 'succeeded'
      ? await persistVideoOutputIfNeeded({
          output: normalizedOutput,
          wmTaskId,
          effectId: effect.id,
          userId: generation.userId,
        })
      : normalizedOutput;

  const nextStatus = result.status === 'succeeded' ? 'succeeded' : 'processing';
  const outputWithQuality =
    nextStatus === 'succeeded'
      ? {
          ...(outputForStore as Record<string, unknown>),
          quality_finalized: true,
        }
      : {
          ...(outputForStore as Record<string, unknown>),
          quality_finalized: false,
        };

  await updateGenerationById({
    id: wmTaskId,
    status: nextStatus,
    output: outputWithQuality,
    error: result.error ?? null,
  });

  return Response.json({
    success: nextStatus === 'succeeded',
    wmTaskId,
    status: nextStatus,
    output: outputWithQuality,
    error: null,
  });
}

export const Route = createFileRoute('/api/effects/1080p')({
  server: {
    handlers: { GET },
  },
});
