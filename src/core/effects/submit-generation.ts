
import { createAdapter } from '@/core/adapters/adapter-factory';
import { linkGenerationInputAssetsByUrls } from '@/core/workspace-lib/assets/user-assets';
import { getEffectById } from '@/core/effects/effects';
import { getWorkspaceEffectRegistryEntryByEffectId } from '@/core/effects/effect-registry';
import {
  getGenerationConcurrencyErrorMessage,
  resolveGenerationConcurrencyGate,
} from '@/core/effects/generation-concurrency';
import {
  resolveGenerationSubmitTransition,
  resolveProviderTaskId,
} from '@/core/effects/generation-orchestrator';
import {
  OUTPUT_STORAGE_SYNC_RETRY_ERROR,
  persistEffectOutputIfNeeded,
  shouldRetryOutputStorageSync,
} from '@/core/effects/output-storage';
import { enqueueEffectsStatusCheck } from '@/core/effects/queue';
import {
  countRunningGenerationsForProject,
  findActiveProjectForUser,
  recordGeneration,
  updateGenerationById,
} from '@/core/effects/record-generation';
import { startBackendPollingForGeneration } from '@/core/effects/server-poller';
import {
  getGenerationPromptMaxChars,
  validateGenerationPrompt,
} from '@/core/effects/validation';
import { getProjectForUser } from '@/core/projects/projects';

export type SubmitEffectGenerationResult = {
  status: number;
  body: Record<string, unknown>;
};

export type SubmitEffectGenerationInput = {
  userId: string;
  isLocalDevBypass?: boolean;
  effectId: number;
  input?: unknown;
  projectId?: string | null;
  requireProject?: boolean;
  metadata?: Record<string, unknown>;
};

const ensureObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};

const getRequestedQuality = (
  input: Record<string, unknown>,
  provider: string
) =>
  provider === 'veo3.1' &&
  (input.wmOutputQuality === '1080p' || input.wmOutputQuality === '4k')
    ? (input.wmOutputQuality as '1080p' | '4k')
    : null;

const linkInputAssets = async ({
  generationId,
  userId,
  input,
}: {
  generationId: string;
  userId: string;
  input: Record<string, unknown>;
}) => {
  const assetUrlKeys = ['image_urls', 'video_urls', 'audio_urls'] as const;

  for (const key of assetUrlKeys) {
    if (!Array.isArray(input[key]) || input[key].length === 0) {
      continue;
    }

    const urls = input[key].filter(
      (item: unknown): item is string => typeof item === 'string'
    );
    if (urls.length === 0) {
      continue;
    }

    await linkGenerationInputAssetsByUrls({
      generationId,
      userId,
      urls,
    });
  }
};

export async function submitEffectGeneration({
  userId,
  effectId,
  input,
  projectId,
  requireProject = true,
  metadata,
}: SubmitEffectGenerationInput): Promise<SubmitEffectGenerationResult> {
  if (!Number.isFinite(effectId)) {
    return { status: 400, body: { error: 'effectId is required' } };
  }

  const effect = await getEffectById(effectId);
  if (!effect) {
    return { status: 404, body: { error: 'Effect not found' } };
  }

  if (!getWorkspaceEffectRegistryEntryByEffectId(effect.id)) {
    return {
      status: 404,
      body: { error: 'Effect is no longer available' },
    };
  }

  if (effect.isOpen === 0) {
    return { status: 403, body: { error: 'Effect is closed' } };
  }
  if (effect.type !== 1 && effect.type !== 2) {
    return {
      status: 400,
      body: { error: 'Only image and video effects are supported.' },
    };
  }

  const normalizedProjectId = projectId?.trim() || null;
  if (requireProject && !normalizedProjectId) {
    return { status: 400, body: { error: 'projectId is required' } };
  }

  if (normalizedProjectId) {
    const currentProject = await getProjectForUser({
      userId,
      projectId: normalizedProjectId,
    });
    if (!currentProject) {
      return { status: 404, body: { error: 'Project not found' } };
    }
  }

  const inputObject = ensureObject(input);
  const {
    callBackUrl: _ignoredCallbackUrl,
    callbackUrl: _ignoredLowercaseCallbackUrl,
    ...sanitizedInput
  } = inputObject;
  const adapter = createAdapter(effect);
  const promptValidation = validateGenerationPrompt(
    typeof sanitizedInput.prompt === 'string' ? sanitizedInput.prompt : '',
    {
      required: true,
      maxChars: getGenerationPromptMaxChars({
        modelId: effect.model,
        provider: effect.provider,
      }),
    }
  );
  if (!promptValidation.ok) {
    return {
      status: 400,
      body: {
        error:
          promptValidation.code === 'PROMPT_TOO_LONG'
            ? `Prompt must be ${promptValidation.maxChars} characters or fewer.`
            : 'Prompt is required.',
      },
    };
  }

  const adapterInput: Record<string, unknown> = {
    ...sanitizedInput,
    prompt: promptValidation.trimmedPrompt,
  };
  const recordedInput = metadata
    ? {
        ...adapterInput,
        _source: metadata,
      }
    : adapterInput;
  const requestedQuality = getRequestedQuality(adapterInput, effect.provider);

  if (normalizedProjectId) {
    const [activeProjectId, runningCountForRequestedProject] =
      await Promise.all([
        findActiveProjectForUser({ userId }),
        countRunningGenerationsForProject({
          userId,
          projectId: normalizedProjectId,
        }),
      ]);
    const concurrencyGate = resolveGenerationConcurrencyGate({
      requestedProjectId: normalizedProjectId,
      activeProjectId,
      runningCountForRequestedProject,
    });
    if (!concurrencyGate.ok) {
      return {
        status: 429,
        body: {
          error: getGenerationConcurrencyErrorMessage(concurrencyGate),
          code: concurrencyGate.code,
          activeProjectId:
            concurrencyGate.code === 'ANOTHER_PROJECT_RUNNING'
              ? concurrencyGate.activeProjectId
              : undefined,
          limit:
            concurrencyGate.code === 'PROJECT_CONCURRENCY_LIMIT'
              ? concurrencyGate.limit
              : undefined,
        },
      };
    }
  }

  const generationId = await recordGeneration({
    userId,
    projectId: normalizedProjectId,
    effectId: effect.id,
    status: 'pending',
    input: recordedInput,
    creditsUsed: 0,
  });

  if (!generationId) {
    return {
      status: 500,
      body: { error: 'Generation request failed, please retry.' },
    };
  }

  try {
    await linkInputAssets({
      generationId,
      userId,
      input: adapterInput,
    });
  } catch (assetLinkError) {
    console.error('linkGenerationInputAssetsByUrls error:', assetLinkError);
  }

  try {
    const result = await adapter.createGeneration(adapterInput);
    const resultError =
      'error' in result && typeof result.error === 'string'
        ? result.error
        : null;
    const providerTaskId = resolveProviderTaskId(result.output);
    const transition = resolveGenerationSubmitTransition({
      generationId,
      providerStatus: result.status,
      providerTaskId,
      requestedQuality,
      previousOutput: {
        creditsRefunded: false,
      },
      providerOutput: result.output,
      providerError: resultError,
    });
    const outputForStore =
      generationId && result.status === 'succeeded'
        ? await persistEffectOutputIfNeeded({
            output: transition.output,
            wmTaskId: generationId,
            effectId: effect.id,
            effectType: effect.type,
            userId,
          })
        : transition.output;
    const storageSyncFailed = shouldRetryOutputStorageSync({
      providerStatus: result.status,
      output: outputForStore,
    });

    const nextStatus = storageSyncFailed
      ? 'processing'
      : transition.publicStatus;
    const nextError = storageSyncFailed
      ? OUTPUT_STORAGE_SYNC_RETRY_ERROR
      : transition.error;

    await updateGenerationById({
      id: generationId,
      status: nextStatus,
      output: outputForStore,
      error: nextError,
      creditsUsed: 0,
    });

    if (nextStatus === 'pending' || nextStatus === 'processing') {
      const enqueueResult = await enqueueEffectsStatusCheck({
        wmTaskId: generationId,
        userId,
        effectId: effect.id,
        attempt: 0,
        source: 'generate',
      });
      if (!enqueueResult.enqueued) {
        startBackendPollingForGeneration({
          wmTaskId: generationId,
          userId,
          effectId: effect.id,
        });
      }
    }

    return {
      status: 200,
      body: {
        success: nextStatus === 'succeeded',
        status: nextStatus,
        wmTaskId: generationId,
        output: outputForStore,
        error:
          nextStatus === 'failed' ? 'Generation failed, please retry.' : null,
      },
    };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateGenerationById({
      id: generationId,
      status: 'failed',
      error: rawMessage,
      creditsUsed: 0,
    });
    console.error('effects.generate error:', rawMessage);
    return {
      status: 500,
      body: { error: 'Generation request failed, please retry.' },
    };
  }
}
