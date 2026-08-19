import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';
import { getUuid } from '@/lib/hash';

import { db } from '@/core/db';
import { envConfigs, AUTH_SECRET_PLACEHOLDER } from '@/config';
import { getAllConfigs } from '@/modules/config/service';
import {
  buildEmailManager,
  hasConfiguredEmailProvider,
} from '@/core/email/configured';
import {
  getResetPasswordEmailCopy,
  getVerifyEmailCopy,
  resolveAuthEmailLocale,
} from '@/core/email/auth-email-copy';
import { VerifyEmail } from '@/core/email/templates/verify-email';
import * as schema from '@/config/db/schema';
import { getLocale } from '@/paraglide/runtime.js';
import { AUTH_PASSWORD_MIN_LENGTH } from '@/core/auth/registration-flow';

function assertProductionAuthSecret() {
  // Only enforce at runtime in production.
  if (process.env.NODE_ENV !== 'production') return;
  const secret = envConfigs.auth_secret;
  if (!secret || secret === AUTH_SECRET_PLACEHOLDER) {
    throw new Error(
      'AUTH_SECRET is missing or still set to the development placeholder. ' +
        'Generate one with `openssl rand -base64 32` and set it before serving traffic.'
    );
  }
}

const recentVerificationEmailSentAt = new Map<string, number>();
const VERIFICATION_EMAIL_MIN_INTERVAL_MS = 60_000;

function getRequestEmailLocaleFallback() {
  try {
    return getLocale();
  } catch {
    return 'zh';
  }
}

function getDatabaseProvider(provider: string): 'sqlite' | 'pg' {
  switch (provider) {
    case 'sqlite':
      return 'sqlite';
    case 'postgresql':
    case 'postgres':
      return 'pg';
    default:
      throw new Error(`Unsupported database provider for auth: ${provider}`);
  }
}

let authInstance: any;
let socialConfigsSignature = '';
let emailEnabledLoaded = true;
let emailVerificationEnabledLoaded = false;

const isCloudflareWorker =
  (typeof navigator !== 'undefined' &&
    navigator.userAgent === 'Cloudflare-Workers') ||
  (typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis);
const TCP_DATABASE_PROVIDERS = ['postgresql', 'postgres'];
const canCacheAuthInstance = !(
  isCloudflareWorker &&
  TCP_DATABASE_PROVIDERS.includes(envConfigs.database_provider)
);

function getSocialProviders(configs: Record<string, string>) {
  const providers: Record<string, any> = {};

  if (configs.google_client_id && configs.google_client_secret) {
    providers.google = {
      clientId: configs.google_client_id,
      clientSecret: configs.google_client_secret,
    };
  }

  return providers;
}

function getSocialSignature(configs: Record<string, string>) {
  return [
    configs.google_client_id || '',
    configs.google_client_secret || '',
    // Including the one-tap flag here so toggling it without changing
    // credentials still rebuilds authInstance (which owns the plugin list).
    configs.google_one_tap_enabled || '',
  ].join('|');
}

function getAuthPlugins(configs: Record<string, string> | undefined) {
  if (!configs) return [];
  const plugins: any[] = [];
  if (configs.google_client_id && configs.google_one_tap_enabled === 'true') {
    plugins.push(oneTap());
  }
  return plugins;
}

export function getAuth(configs?: Record<string, string>) {
  assertProductionAuthSecret();
  // Rebuild if any social provider credential changed
  if (configs) {
    const nextSignature = getSocialSignature(configs);
    if (nextSignature !== socialConfigsSignature) {
      authInstance = null;
      socialConfigsSignature = nextSignature;
    }
  }

  // Rebuild if the email-auth flag changed
  if (configs) {
    const nextEmailEnabled = configs.email_auth_enabled !== 'false';
    if (nextEmailEnabled !== emailEnabledLoaded) {
      authInstance = null;
      emailEnabledLoaded = nextEmailEnabled;
    }
  }

  // Rebuild if the email-verification flag changed
  if (configs) {
    const nextVerificationEnabled =
      configs.email_verification_enabled === 'true' &&
      hasConfiguredEmailProvider(configs);
    if (nextVerificationEnabled !== emailVerificationEnabledLoaded) {
      authInstance = null;
      emailVerificationEnabledLoaded = nextVerificationEnabled;
    }
  }

  if (canCacheAuthInstance && authInstance) return authInstance;

  const socialProviders = configs ? getSocialProviders(configs) : {};
  const emailAndPasswordEnabled = configs ? configs.email_auth_enabled !== 'false' : true;
  const emailVerificationEnabled = configs
    ? configs.email_verification_enabled === 'true' &&
      hasConfiguredEmailProvider(configs)
    : false;

  const nextAuthInstance = betterAuth({
    appName: envConfigs.app_name,
    baseURL: envConfigs.auth_url || envConfigs.app_url,
    secret: envConfigs.auth_secret,
    trustedOrigins: (request) => {
      const origins: string[] = [];
      if (envConfigs.app_url) origins.push(envConfigs.app_url);
      try {
        const origin = request?.headers?.get?.('origin');
        if (origin && new URL(origin).hostname === 'localhost') origins.push(origin);
      } catch {}
      return origins;
    },
    database: drizzleAdapter(db(), {
      provider: getDatabaseProvider(envConfigs.database_provider),
      schema,
    }),
    socialProviders,
    plugins: getAuthPlugins(configs),
    user: {
      additionalFields: {
        // BeatAPI fields
        role: { type: 'string', input: false, required: false, defaultValue: null },
        banned: { type: 'boolean', input: false, required: false, defaultValue: null },
        banReason: { type: 'string', input: false, required: false, defaultValue: null },
        banExpires: { type: 'date', input: false, required: false, defaultValue: null },
        customerId: { type: 'string', input: false, required: false, defaultValue: null },
        subscriptionState: { type: 'string', input: false, required: false, defaultValue: 'free' },
        normalizedEmail: { type: 'string', input: false, required: false, defaultValue: null },
      },
    },
    advanced: {
      database: { generateId: () => getUuid() },
    },
    emailAndPassword: {
      enabled: emailAndPasswordEnabled,
      minPasswordLength: AUTH_PASSWORD_MIN_LENGTH,
      requireEmailVerification: emailVerificationEnabled,
      autoSignIn: !emailVerificationEnabled,
      sendResetPassword: async ({ user, url }) => {
        const all = await getAllConfigs();
        if (!hasConfiguredEmailProvider(all)) {
          console.error('[auth] sendResetPassword: no email provider is configured');
          return;
        }
        const appName = all.app_name || envConfigs.app_name;
        const manager = buildEmailManager(all);
        const locale = resolveAuthEmailLocale(url, getRequestEmailLocaleFallback());
        const copy = getResetPasswordEmailCopy({
          locale,
          appName,
          userName: user.name,
          url,
        });
        const result = await manager.sendEmail({
          to: user.email,
          subject: copy.subject,
          text: copy.text,
          html: copy.html,
        });
        if (!result.success) {
          console.error('[auth] sendResetPassword failed:', result.error);
        }
      },
    },
    ...(emailVerificationEnabled
      ? {
          emailVerification: {
            sendOnSignUp: false,
            sendOnSignIn: false,
            autoSignInAfterVerification: true,
            expiresIn: 60 * 60 * 24,
            sendVerificationEmail: async ({ user, url }: { user: any; url: string; token: string }) => {
              try {
                const key = String(user?.email || '').toLowerCase();
                const now = Date.now();
                const last = recentVerificationEmailSentAt.get(key) || 0;
                if (key && now - last < VERIFICATION_EMAIL_MIN_INTERVAL_MS) {
                  return;
                }

                const all = await getAllConfigs();
                if (!hasConfiguredEmailProvider(all)) {
                  console.error('[auth] sendVerificationEmail: no email provider is configured');
                  throw new Error('Email verification service is unavailable');
                }
                const appName = all.app_name || envConfigs.app_name;
                const logo = all.app_logo || '';
                const logoUrl = logo.startsWith('http')
                  ? logo
                  : logo
                  ? `${envConfigs.app_url || ''}${logo.startsWith('/') ? '' : '/'}${logo}`
                  : undefined;
                const manager = buildEmailManager(all);
                const locale = resolveAuthEmailLocale(url, getRequestEmailLocaleFallback());
                const copy = getVerifyEmailCopy({ locale, appName });
                const result = await manager.sendEmail({
                  to: user.email,
                  subject: copy.subject,
                  react: VerifyEmail({ appName, logoUrl, url, locale }),
                });
                if (!result.success) {
                  console.error('[auth] sendVerificationEmail failed:', result.error);
                  throw new Error('Failed to send verification email');
                }
                if (key) {
                  recentVerificationEmailSentAt.set(key, now);
                }
              } catch (e) {
                console.error('[auth] sendVerificationEmail error:', e);
                throw e instanceof Error
                  ? e
                  : new Error('Failed to send verification email');
              }
            },
          },
        }
      : {}),
    logger: { disabled: true },
  } satisfies BetterAuthOptions);

  if (canCacheAuthInstance) {
    authInstance = nextAuthInstance;
  }

  return nextAuthInstance;
}
