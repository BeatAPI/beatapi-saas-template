import { createFileRoute } from '@tanstack/react-router';
import { cleanupStaleGenerations } from '@/core/effects/stale-generations';

const resolveProcessSecret = () =>
  process.env.EFFECTS_PROCESS_SECRET || process.env.CRON_SECRET || null;

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

const authorizeCleanupRequest = (request: Request) => {
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
      error: 'Unauthorized cleanup request',
    } as const;
  }

  return { ok: true } as const;
};

async function GET({ request }: { request: Request }) {
  const authorization = authorizeCleanupRequest(request);
  if (!authorization.ok) {
    console.error('cleanup stale generations unauthorized');
    return Response.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  const result = await cleanupStaleGenerations();
  return Response.json({
    message: `cleanup stale generations success, scanned: ${result.scannedCount}, processed: ${result.processedCount}, failed: ${result.failedCount}, succeeded: ${result.succeededCount}, errors: ${result.errorCount}`,
    ...result,
  });
}

export const Route = createFileRoute('/api/cleanup-stale-generations')({
  server: {
    handlers: { GET },
  },
});
