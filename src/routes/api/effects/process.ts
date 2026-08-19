import { createFileRoute } from '@tanstack/react-router';
import type { EffectsStatusCheckMessage } from '@/core/effects/queue';
import {
  runDueGenerationStatusPasses,
  runGenerationStatusPass,
} from '@/core/effects/server-poller';

const MAX_BATCH_LIMIT = 25;
const DEFAULT_BATCH_LIMIT = 10;

const isEffectsStatusCheckMessage = (
  value: unknown
): value is EffectsStatusCheckMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.wmTaskId === 'string' &&
    candidate.wmTaskId.length > 0 &&
    typeof candidate.userId === 'string' &&
    candidate.userId.length > 0 &&
    typeof candidate.effectId === 'number' &&
    Number.isFinite(candidate.effectId) &&
    typeof candidate.attempt === 'number' &&
    Number.isFinite(candidate.attempt) &&
    (candidate.source === 'generate' ||
      candidate.source === 'callback' ||
      candidate.source === 'retry')
  );
};

const resolveProcessSecret = () =>
  process.env.EFFECTS_PROCESS_SECRET || process.env.CRON_SECRET || null;

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

const authorizeProcessRequest = (request: Request) => {
  const secret = resolveProcessSecret();
  if (!secret) {
    return {
      ok: false,
      status: 500,
      error: 'Effects process secret is not configured',
    } as const;
  }

  const providedSecret =
    request.headers.get('x-effects-process-secret') ?? getBearerToken(request);

  if (providedSecret !== secret) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized effects process request',
    } as const;
  }

  return { ok: true } as const;
};

const parseLimit = (request: Request) => {
  const url = new URL(request.url);
  const limitValue = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  if (!Number.isFinite(limitValue)) {
    return DEFAULT_BATCH_LIMIT;
  }
  return Math.max(1, Math.min(limitValue, MAX_BATCH_LIMIT));
};

const runBatch = async (request: Request) => {
  const result = await runDueGenerationStatusPasses({
    limit: parseLimit(request),
  });

  return Response.json({
    success: true,
    mode: 'batch',
    ...result,
  });
};

async function GET({ request }: { request: Request }) {
  const authorization = authorizeProcessRequest(request);
  if (!authorization.ok) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  return runBatch(request);
}

async function POST({ request }: { request: Request }) {
  const authorization = authorizeProcessRequest(request);
  if (!authorization.ok) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return runBatch(request);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isEffectsStatusCheckMessage(payload)) {
    return Response.json(
      { error: 'Invalid effects status check payload' },
      { status: 400 }
    );
  }

  const result = await runGenerationStatusPass({
    wmTaskId: payload.wmTaskId,
    userId: payload.userId,
    effectId: payload.effectId,
  });

  return Response.json({
    success: true,
    mode: 'single',
    shouldRetry: result.shouldRetry,
    retryAfterMs: result.retryAfterMs,
  });
}

export const Route = createFileRoute('/api/effects/process')({
  server: {
    handlers: { GET, POST },
  },
});
