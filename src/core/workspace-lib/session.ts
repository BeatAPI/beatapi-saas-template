import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import type { Session } from './auth-types';

/**
 * Resolve the current session from the active request context.
 *
 * Wrapped in createServerFn so TanStack enforces the server/client boundary:
 * client code calls these as RPC (the server-only getRequest/getAuth never
 * reach the client bundle). Use inside route loaders, beforeLoad, or other
 * server functions.
 */

export const getSession = createServerFn().handler(async () => {
  try {
    const request = getRequest();
    const { getAuth } = await import('@/core/auth');
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return (session as Session | null) ?? null;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[session] getSession called without request context:', error);
    }
    return null;
  }
});

/**
 * Require an authenticated user; returns the session or throws.
 */
export const requireSession = createServerFn().handler(async () => {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
});

/**
 * Require an admin user; returns the session or throws.
 */
export const requireAdminSession = createServerFn().handler(async () => {
  const session = await requireSession();
  if (session.user.role !== 'admin') {
    throw new Error('Unauthorized: admin role required');
  }
  return session;
});
