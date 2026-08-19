
import { getAuth } from '@/core/auth';
import type { Session } from './auth-types';

/**
 * Validates session for API routes.
 *
 * Uses the real better-auth instance (getAuth) — NOT the shim stub — so
 * session cookies are actually parsed. Required for production (the old
 * shim auth always returned null, which only "worked" under local-dev
 * bypass in resolveRequestUser).
 *
 * @param request - The incoming request (carries the session cookie)
 * @returns Session object if valid, null otherwise
 */
export async function requireSession(
  request: Request
): Promise<Session | null> {
  const auth = getAuth();
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return null;
  }

  return session as Session;
}

/**
 * Creates a 401 Unauthorized response for API routes
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return Response.json({ error: message }, { status: 401 });
}
