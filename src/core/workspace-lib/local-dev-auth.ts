import { getDb } from '@/core/workspace-lib/db-adapter';
import { user } from '@/config/db/schema';
import { eq } from 'drizzle-orm';

export const LOCAL_DEV_EFFECTS_USER_ID = 'local-dev-effects-user';

const LOCAL_DEV_EFFECTS_EMAIL = 'local-dev-effects@beat-ai.local';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

const normalizeHostname = (value: string | null | undefined) =>
  value?.split(':')[0]?.trim().toLowerCase() ?? null;

const getHostnameFromUrl = (requestUrl: string | null | undefined) => {
  if (!requestUrl) return null;

  try {
    return new URL(requestUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const isLocalDevAuthBypassEnabled = ({
  nodeEnv = process.env.NODE_ENV,
  requestUrl,
  hostHeader,
}: {
  nodeEnv?: string;
  requestUrl?: string | null;
  hostHeader?: string | null;
}) => {
  if (nodeEnv === 'production') {
    return false;
  }

  const hostname =
    normalizeHostname(hostHeader) ?? getHostnameFromUrl(requestUrl);

  return hostname ? LOCAL_HOSTNAMES.has(hostname) : false;
};

const ensureLocalDevEffectsUser = async () => {
  const db = await getDb();
  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, LOCAL_DEV_EFFECTS_USER_ID))
    .limit(1);

  if (existingUser[0]?.id) {
    return LOCAL_DEV_EFFECTS_USER_ID;
  }

  try {
    await db.insert(user).values({
      id: LOCAL_DEV_EFFECTS_USER_ID,
      name: 'Local Dev Effects',
      email: LOCAL_DEV_EFFECTS_EMAIL,
      normalizedEmail: LOCAL_DEV_EFFECTS_EMAIL,
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: 'admin',
      banned: false,
      banReason: null,
      banExpires: null,
      customerId: null,
      subscriptionState: 'free',
    });
  } catch (error) {
    console.error('ensureLocalDevEffectsUser error:', error);
  }

  return LOCAL_DEV_EFFECTS_USER_ID;
};

export const resolveRequestUser = async (
  request: Pick<Request, 'url' | 'headers'>,
  sessionUserId?: string | null
) => {
  if (sessionUserId) {
    return {
      userId: sessionUserId,
      isLocalDevBypass: false,
    };
  }

  if (
    !isLocalDevAuthBypassEnabled({
      requestUrl: request.url,
      hostHeader: request.headers.get('host'),
    })
  ) {
    return null;
  }

  const userId = await ensureLocalDevEffectsUser();
  return {
    userId,
    isLocalDevBypass: true,
  };
};
