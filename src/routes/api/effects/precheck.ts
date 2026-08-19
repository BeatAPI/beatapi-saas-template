import { getWorkspaceEffectRegistryEntryByEffectId } from '@/core/effects/effect-registry';
import { getEffectById } from '@/core/effects/effects';
import {
  getGenerationConcurrencyErrorMessage,
  resolveGenerationConcurrencyGate,
} from '@/core/effects/generation-concurrency';
import {
  countRunningGenerationsForProject,
  findActiveProjectForUser,
} from '@/core/effects/record-generation';
import {
  getGenerationPromptMaxChars,
  validateGenerationPrompt,
} from '@/core/effects/validation';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import { getProjectForUser } from '@/core/projects/projects';
import { requireSession } from '@/core/workspace-lib/require-session';
import { createFileRoute } from '@tanstack/react-router';

type PrecheckRequest = {
  effectId?: number;
  input?: unknown;
  projectId?: string;
};

const ensureObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};

async function POST({ request }: { request: Request }) {
  const session = await requireSession(request);
  const resolvedUser = await resolveRequestUser(request, session?.user.id);
  if (!resolvedUser) {
    return Response.json(
      { error: 'Please sign in first.' },
      { status: 401 }
    );
  }
  const { userId } = resolvedUser;

  let payload: PrecheckRequest | null = null;
  try {
    payload = (await request.json()) as PrecheckRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload || !Number.isFinite(payload.effectId)) {
    return Response.json(
      { error: 'effectId is required' },
      { status: 400 }
    );
  }

  const effect = await getEffectById(payload.effectId as number);
  if (!effect) {
    return Response.json({ error: 'Effect not found' }, { status: 404 });
  }
  if (!getWorkspaceEffectRegistryEntryByEffectId(effect.id)) {
    return Response.json(
      { error: 'Effect is no longer available' },
      { status: 404 }
    );
  }
  if (effect.isOpen === 0) {
    return Response.json({ error: 'Effect is closed' }, { status: 403 });
  }
  if (effect.type !== 1 && effect.type !== 2) {
    return Response.json(
      { error: 'Only image and video effects are supported.' },
      { status: 400 }
    );
  }

  const projectId = payload.projectId?.trim() || null;
  if (!projectId) {
    return Response.json(
      { error: 'projectId is required' },
      { status: 400 }
    );
  }

  const currentProject = await getProjectForUser({ userId, projectId });
  if (!currentProject) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const [activeProjectId, runningCountForRequestedProject] = await Promise.all([
    findActiveProjectForUser({ userId }),
    countRunningGenerationsForProject({ userId, projectId }),
  ]);
  const concurrencyGate = resolveGenerationConcurrencyGate({
    requestedProjectId: projectId,
    activeProjectId,
    runningCountForRequestedProject,
  });
  if (!concurrencyGate.ok) {
    return Response.json(
      {
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
      { status: 429 }
    );
  }

  const adapterInput = ensureObject(payload.input);
  const promptValidation = validateGenerationPrompt(
    typeof adapterInput.prompt === 'string' ? adapterInput.prompt : '',
    {
      required: true,
      maxChars: getGenerationPromptMaxChars({ provider: effect.provider }),
    }
  );
  if (!promptValidation.ok) {
    return Response.json(
      {
        error:
          promptValidation.code === 'PROMPT_TOO_LONG'
            ? `Prompt must be ${promptValidation.maxChars} characters or fewer.`
            : 'Prompt is required.',
      },
      { status: 400 }
    );
  }

  return Response.json({
    success: true,
    requiredCredits: 0,
  });
}

export const Route = createFileRoute('/api/effects/precheck')({
  server: {
    handlers: { POST },
  },
});
