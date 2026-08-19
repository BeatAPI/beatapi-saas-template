import { getRequest } from '@tanstack/react-start/server';
import { getAuth } from '@/core/auth';

/**
 * Get the current session from the active request context.
 *
 * Uses TanStack's getRequest() to read the real incoming request headers
 * (replaces Next.js headers() which returned empty Headers via the shim).
 * Falls back to null when called outside a request (e.g. during build).
 *
 * NOTE: This is for code that can't receive a `request` argument directly.
 * Prefer `requireSession(request)` or `getSession()` from `./session`
 * inside server functions where possible.
 */
export async function getSession() {
  try {
    const request = getRequest();
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return session ?? null;
  } catch {
    // No active request context (build time, or called outside a server fn)
    return null;
  }
}
