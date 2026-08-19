import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { getAllConfigs } from '@/modules/config/service';

// better-auth catch-all — the handler takes a standard Request and
// returns a standard Response, so it mounts directly.
async function handle(request: Request) {
  const url = new URL(request.url);
  if (url.pathname === '/api/auth/error') {
    const target = new URL('/auth-error', url.origin);
    const error = url.searchParams.get('error');
    if (error) target.searchParams.set('error', error);
    return Response.redirect(target, 302);
  }

  const configs = await getAllConfigs();
  const auth = getAuth(configs);
  return auth.handler(request);
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
