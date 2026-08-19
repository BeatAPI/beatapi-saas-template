import { createFileRoute } from '@tanstack/react-router';
import { getConfiguredBaseUrl, shouldAppendLocale } from '@/core/workspace-lib/urls/urls';
import { handleZpayReturn } from '@/core/workspace-lib/payment/provider/zpay';
import { Routes } from '@/core/workspace-lib/shims/routes';
import type { Locale } from '@/core/workspace-lib/shims/next-intl';

function withLocale(path: string, locale: Locale | null): string {
  return shouldAppendLocale(locale) ? `/${locale}${path}` : path;
}

async function GET({ request }: { request: Request }): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;
  const { outTradeNo, locale } = await handleZpayReturn(searchParams);
  const paymentPath = outTradeNo
    ? `${withLocale(Routes.Payment, locale)}?${new URLSearchParams({
        session_id: outTradeNo,
        callback: Routes.History,
      }).toString()}`
    : withLocale(Routes.History, locale);

  return Response.redirect(new URL(paymentPath, getConfiguredBaseUrl()));
}

export const Route = createFileRoute('/api/payment/zpay/return')({
  server: {
    handlers: { GET },
  },
});
