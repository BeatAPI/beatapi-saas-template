import type { ReactNode } from 'react';

import { Brand } from '@/components/marketing/beatapi-product-shell';
import { getLocale } from '@/paraglide/runtime.js';

/**
 * Shared dark chrome for the auth pages (sign-in, sign-up, password reset,
 * email verification). Keeps the BeatAPI product skin — orange radial glow,
 * dot grid, display brand — instead of the light template card.
 */
export function AuthPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const locale = getLocale();
  return (
    <div
      lang={locale === 'zh' ? 'zh' : 'en'}
      className="beat-auth-shell beat-product-shell relative flex min-h-svh flex-col items-center justify-center gap-7 px-5 py-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,122,51,0.09),transparent_32%),radial-gradient(circle,rgba(255,255,255,0.13)_0.75px,transparent_0.9px)] [background-size:auto,8px_8px] [mask-image:radial-gradient(ellipse_58%_52%_at_center,black_8%,transparent_76%)]"
      />
      <div className="relative">
        <Brand />
      </div>
      <div className="beat-auth-card relative w-full max-w-sm rounded-[var(--beat-radius)] border border-white/[0.13] bg-[linear-gradient(145deg,#1b1b1e_0%,#151517_100%)] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.035)] sm:p-7">
        <h1 className="text-center text-lg font-semibold tracking-[-0.02em] text-[var(--beat-text-1)]">
          {title}
        </h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
