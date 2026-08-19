import { createFileRoute } from '@tanstack/react-router';
import { submitEffectGeneration } from '@/core/effects/submit-generation';
import { resolveRequestUser } from '@/core/workspace-lib/local-dev-auth';
import { requireSession } from '@/core/workspace-lib/require-session';

type GenerateRequest = {
  effectId: number;
  input?: unknown;
  projectId?: string;
};

async function POST({ request }: { request: Request }) {
  const session = await requireSession(request);
  const resolvedUser = await resolveRequestUser(request, session?.user.id);
  if (!resolvedUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: GenerateRequest | null = null;
  try {
    payload = (await request.json()) as GenerateRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = await submitEffectGeneration({
    userId: resolvedUser.userId,
    isLocalDevBypass: resolvedUser.isLocalDevBypass,
    effectId: payload?.effectId ?? Number.NaN,
    input: payload?.input,
    projectId: payload?.projectId,
    requireProject: true,
  });

  return Response.json(result.body, { status: result.status });
}

export const Route = createFileRoute('/api/effects/generate')({
  server: {
    handlers: { POST },
  },
});
