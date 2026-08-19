import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeft, Home, RefreshCw, ShieldAlert } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

function getAuthErrorCopy(locale: 'en' | 'zh', error?: string) {
  const errorPrefix =
    error === 'internal_server_error'
      ? 'internal'
      : error === 'access_denied'
        ? 'accessDenied'
        : 'default';

  return {
    eyebrow: m['BeatAPI.authError.eyebrow']({}, { locale }),
    backToLogin: m['BeatAPI.authError.backToLogin']({}, { locale }),
    codeLabel: m['BeatAPI.authError.codeLabel']({}, { locale }),
    retryLogin: m['BeatAPI.authError.retryLogin']({}, { locale }),
    home: m['BeatAPI.authError.home']({}, { locale }),
    asideTitle: m['BeatAPI.authError.asideTitle']({}, { locale }),
    localCallback: m['BeatAPI.authError.localCallback']({}, { locale }),
    productionCallback: m['BeatAPI.authError.productionCallback'](
      {},
      { locale }
    ),
    title: m[`BeatAPI.authError.${errorPrefix}Title`]({}, { locale }),
    description: m[`BeatAPI.authError.${errorPrefix}Description`](
      {},
      { locale }
    ),
    detail: m[`BeatAPI.authError.${errorPrefix}Detail`]({}, { locale }),
  };
}

function AuthErrorPage() {
  const { error } = Route.useSearch();
  const locale = getLocale().startsWith('zh') ? 'zh' : 'en';
  const copy = getAuthErrorCopy(locale, error);
  const displayCode = error || 'unknown_error';

  return (
    <main className="min-h-svh bg-[#f7f8fb] text-[#111827]">
      <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex h-14 items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-[-0.03em]">
              <img src="/logo.png" alt="" className="size-9 object-contain" />
              BeatAPI
            </span>
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="size-4" />
            {copy.backToLogin}
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-12">
          <div className="grid w-full items-stretch gap-6 md:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-md border border-black/10 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 inline-flex size-11 items-center justify-center rounded-md bg-red-50 text-red-600 ring-1 ring-red-100">
                <ShieldAlert className="size-5" />
              </div>

              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-gray-400">
                {copy.eyebrow}
              </p>
              <h1 className="text-3xl font-semibold tracking-normal text-gray-950 sm:text-4xl">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
                {copy.description}
              </p>

              <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-xs font-medium text-gray-400">
                  {copy.codeLabel}
                </div>
                <code className="mt-1 block break-all font-mono text-sm text-gray-800">
                  {displayCode}
                </code>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-in"
                  className={cn(buttonVariants(), 'h-10 gap-2 px-4')}
                >
                  <RefreshCw className="size-4" />
                  {copy.retryLogin}
                </Link>
                <Link
                  href="/"
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'h-10 gap-2 px-4'
                  )}
                >
                  <Home className="size-4" />
                  {copy.home}
                </Link>
              </div>
            </div>

            <aside className="rounded-md border border-black/10 bg-[#111827] p-6 text-white shadow-sm sm:p-8">
              <div className="mb-8 h-1.5 w-16 rounded-full bg-[#2D6BE6]" />
              <h2 className="text-xl font-semibold">{copy.asideTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-300">
                {copy.detail}
              </p>
              <div className="mt-8 grid gap-3 text-sm">
                <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <div className="font-medium text-white">
                    {copy.localCallback}
                  </div>
                  <code className="mt-1 block break-all text-xs text-gray-300">
                    http://localhost:3020/api/auth/callback/google
                  </code>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <div className="font-medium text-white">
                    {copy.productionCallback}
                  </div>
                  <code className="mt-1 block break-all text-xs text-gray-300">
                    https://your-domain.com/api/auth/callback/google
                  </code>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

export const Route = createFileRoute('/auth-error')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: AuthErrorPage,
});
