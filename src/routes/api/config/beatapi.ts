import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { getConfig, saveConfigs } from '@/modules/config/service';
import { DEFAULT_BEATAPI_BASE_URL } from '@/core/beatcanvas/providers/provider-config';

/**
 * Workspace-level BeatAPI provider configuration. The dialog pre-fills the
 * official endpoint so a signed-in user only has to paste an API key.
 */
async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized', 401);

    const [baseUrl, apiKey] = await Promise.all([
      getConfig('BEATAPI_API_BASE_URL'),
      getConfig('BEATAPI_API_KEY'),
    ]);

    return respData({
      baseUrl:
        baseUrl ||
        process.env.BEATAPI_API_BASE_URL ||
        DEFAULT_BEATAPI_BASE_URL,
      apiKeyConfigured: Boolean(apiKey || process.env.BEATAPI_API_KEY),
    });
  } catch {
    return respErr('Internal error', 500);
  }
}

async function POST({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized', 401);

    const body = (await request.json().catch(() => null)) as {
      baseUrl?: unknown;
      apiKey?: unknown;
    } | null;
    if (!body || typeof body !== 'object') return respErr('Invalid body');

    const next: Record<string, string> = {};
    if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) {
      next.BEATAPI_API_BASE_URL = body.baseUrl.trim().replace(/\/+$/, '');
    }
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      next.BEATAPI_API_KEY = body.apiKey.trim();
    }
    if (Object.keys(next).length === 0) return respErr('Nothing to save');

    await saveConfigs(next);
    return respData({ ok: true });
  } catch {
    return respErr('Internal error', 500);
  }
}

export const Route = createFileRoute('/api/config/beatapi')({
  server: {
    handlers: { GET, POST },
  },
});
