export const AUTH_PASSWORD_MIN_LENGTH = 6;

type SignInErrorLike = {
  code?: string;
  status?: number;
};

export function classifyEmailSignInError(
  error?: SignInErrorLike | null
): 'unverified' | 'credentials' | 'generic' {
  if (error?.code === 'EMAIL_NOT_VERIFIED') return 'unverified';
  if (
    error?.code === 'INVALID_EMAIL_OR_PASSWORD' ||
    error?.status === 401
  ) {
    return 'credentials';
  }
  return 'generic';
}

const AUTH_LOOP_PATHS = new Set([
  '/sign-in',
  '/sign-up',
  '/verify-email',
  '/verify-email-complete',
]);

export function getSafeAuthCallback(raw?: string | null): string {
  if (!raw) return '/';
  try {
    const base = new URL('https://callback.invalid');
    const candidate = new URL(raw, base);
    if (candidate.origin !== base.origin) return '/';
    if (AUTH_LOOP_PATHS.has(candidate.pathname)) return '/';
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return '/';
  }
}

export class VerificationEmailDeliveryError extends Error {
  constructor(message?: string) {
    super(message || 'Failed to send verification email');
    this.name = 'VerificationEmailDeliveryError';
  }
}

type CompleteEmailAuthHandoffParams = {
  email: string;
  afterLoginUrl?: string;
  emailVerificationEnabled: boolean;
  localizeCallbackUrl: (href: string) => string;
  sendVerificationEmail: (params: {
    email: string;
    callbackURL: string;
  }) => Promise<void>;
};

export async function completeEmailAuthHandoff({
  email,
  afterLoginUrl,
  emailVerificationEnabled,
  localizeCallbackUrl,
  sendVerificationEmail,
}: CompleteEmailAuthHandoffParams) {
  const safeAfterLoginUrl = getSafeAuthCallback(afterLoginUrl);
  if (!emailVerificationEnabled) return safeAfterLoginUrl;

  const normalizedEmail = email.trim().toLowerCase();
  try {
    await sendVerificationEmail({
      email: normalizedEmail,
      callbackURL: localizeCallbackUrl(safeAfterLoginUrl),
    });
  } catch (error) {
    throw new VerificationEmailDeliveryError(
      error instanceof Error ? error.message : undefined
    );
  }

  const query = new URLSearchParams();
  // Avoid numeric-looking search values: TanStack's search serializer quotes
  // strings such as "1" to preserve their type, which breaks URLSearchParams
  // consumers that compare against the unquoted value.
  query.set('sent', 'confirmed');
  query.set('email', normalizedEmail);
  query.set('callbackUrl', safeAfterLoginUrl);
  return `/verify-email?${query.toString()}`;
}

export function buildEmailVerificationHandoffUrl({
  baseUrl,
  token,
  callbackURL,
}: {
  baseUrl: string;
  token: string;
  callbackURL?: string;
}) {
  const url = new URL('/verify-email-complete', baseUrl);
  const handoff = new URLSearchParams();
  handoff.set('token', token);
  handoff.set('callbackURL', getSafeAuthCallback(callbackURL));
  url.hash = handoff.toString();
  return url.toString();
}

export function getEmailVerificationCompletionPath(search: string) {
  const source = new URLSearchParams(search.replace(/^[?#]/, ''));
  const token = source.get('token');
  if (!token) return null;

  const target = new URLSearchParams();
  target.set('token', token);
  target.set(
    'callbackURL',
    getSafeAuthCallback(source.get('callbackURL'))
  );
  return `/api/auth/verify-email?${target.toString()}`;
}
