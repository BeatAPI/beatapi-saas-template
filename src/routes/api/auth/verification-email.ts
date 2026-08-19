import { createEmailVerificationToken } from 'better-auth/api';
import { createFileRoute } from '@tanstack/react-router';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { envConfigs } from '@/config';
import { user } from '@/config/db/schema';
import { db } from '@/core/db';
import { buildEmailVerificationHandoffUrl } from '@/core/auth/registration-flow';
import {
  buildEmailManager,
  hasConfiguredEmailProvider,
} from '@/core/email/configured';
import { getVerifyEmailCopy } from '@/core/email/auth-email-copy';
import { VerifyEmail } from '@/core/email/templates/verify-email';
import { getAllConfigs } from '@/modules/config/service';
import { md5 } from '@/lib/hash';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

const requestSchema = z.object({
  email: z.string().trim().email(),
  callbackURL: z.string().optional(),
});

const VERIFICATION_EMAIL_EXPIRES_IN_SECONDS = 60 * 60 * 24;
const VERIFICATION_EMAIL_MIN_INTERVAL_MS = 60_000;

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(envConfigs.app_url).origin;
  } catch {
    return false;
  }
}

function getSafeCallbackPath(raw: string | undefined) {
  try {
    const appUrl = new URL(envConfigs.app_url);
    const callbackUrl = new URL(raw || '/', appUrl);
    if (callbackUrl.origin !== appUrl.origin) return '/';
    return `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
  } catch {
    return '/';
  }
}

function getLogoUrl(logo: string) {
  if (!logo) return undefined;
  if (logo.startsWith('http://') || logo.startsWith('https://')) return logo;
  return new URL(logo.startsWith('/') ? logo : `/${logo}`, envConfigs.app_url).toString();
}

async function POST({ request }: { request: Request }) {
  if (!hasTrustedOrigin(request)) return respErr('Invalid origin');

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) return respErr('A valid email is required');

  const normalizedEmail = parsed.data.email.toLowerCase();
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: VERIFICATION_EMAIL_MIN_INTERVAL_MS,
    keyPrefix: 'auth-verification-email',
    extraKey: md5(normalizedEmail),
    includeCookie: false,
  });
  if (limited) return limited;

  try {
    const [existingUser] = await db()
      .select({
        email: user.email,
        emailVerified: user.emailVerified,
      })
      .from(user)
      .where(eq(user.email, normalizedEmail))
      .limit(1);

    // Match Better Auth's anti-enumeration behavior: do not reveal whether an
    // address is registered or already verified.
    if (!existingUser || existingUser.emailVerified) {
      return respData({ status: true });
    }

    const configs = await getAllConfigs();
    if (configs.email_verification_enabled !== 'true') {
      return respErr('Email verification is disabled');
    }

    if (!hasConfiguredEmailProvider(configs)) {
      console.error('[auth] verification email service is not configured');
      return respErr('Verification email service is unavailable');
    }

    const callbackURL = getSafeCallbackPath(parsed.data.callbackURL);
    const token = await createEmailVerificationToken(
      envConfigs.auth_secret,
      existingUser.email,
      undefined,
      VERIFICATION_EMAIL_EXPIRES_IN_SECONDS
    );
    const verificationUrl = buildEmailVerificationHandoffUrl({
      baseUrl: envConfigs.app_url,
      token,
      callbackURL,
    });
    const locale = callbackURL === '/zh' || callbackURL.startsWith('/zh/')
      ? 'zh'
      : 'en';
    const appName = configs.app_name || envConfigs.app_name;
    const manager = buildEmailManager(configs);
    const copy = getVerifyEmailCopy({ locale, appName });
    const result = await manager.sendEmail({
      to: existingUser.email,
      subject: copy.subject,
      react: VerifyEmail({
        appName,
        logoUrl: getLogoUrl(configs.app_logo || ''),
        url: verificationUrl,
        locale,
      }),
    });

    if (!result.success) {
      console.error('[auth] reliable verification email delivery failed');
      return respErr('Failed to send verification email');
    }

    return respData({ status: true });
  } catch (error) {
    console.error('[auth] reliable verification email request failed');
    return respErr(
      error instanceof Error && error.message
        ? 'Failed to send verification email'
        : 'Verification email service is unavailable'
    );
  }
}

export const Route = createFileRoute('/api/auth/verification-email')({
  server: {
    handlers: { POST },
  },
});
