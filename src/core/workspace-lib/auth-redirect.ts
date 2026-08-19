import { DEFAULT_LOCALE } from '@/core/workspace-lib/shims/i18n';
import { DEFAULT_LOGIN_REDIRECT, Routes } from '@/core/workspace-lib/shims/routes';
import type { Locale } from '@/core/workspace-lib/shims/next-intl';

export function getLocalizedRoute(
  pathname: string,
  locale?: Locale | string | null
) {
  if (!locale || locale === DEFAULT_LOCALE) {
    return pathname;
  }

  return pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
}

export function buildLoginPath({
  locale,
  callbackUrl,
}: {
  locale?: Locale | string | null;
  callbackUrl?: string | null;
}) {
  // BeatAPI used Routes.Login (/auth/login), but under TanStack the sign-in
  // page lives at /sign-in (Routes.SIGN_IN). Locale prefix is handled by the
  // paraglide router rewrite, so we use the bare path.
  const loginPath = Routes.SIGN_IN;
  if (!callbackUrl) {
    return loginPath;
  }

  return `${loginPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function resolvePostAuthRedirect({
  locale,
  callbackUrl,
}: {
  locale?: Locale | string | null;
  callbackUrl?: string | null;
}) {
  if (callbackUrl?.trim()) {
    return callbackUrl;
  }

  return getLocalizedRoute(DEFAULT_LOGIN_REDIRECT, locale);
}
