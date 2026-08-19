import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  Loader2Icon,
  RefreshCwIcon,
  XCircleIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { buildLoginPath } from '@/core/workspace-lib/auth-redirect';
import { invalidateWorkspaceAfterPaymentChange } from '@/core/workspace-lib/app/workspace-query-invalidation';
import {
  PAYMENT_MAX_POLL_TIME,
  PAYMENT_POLL_INTERVAL,
} from '@/core/workspace-lib/constants';
import { usePaymentCompletion } from '@/core/workspace-hooks/use-payment-completion';
import { getSession } from '@/core/workspace-lib/session';
import { Routes } from '@/core/workspace-lib/shims/routes';
import { useLocaleRouter } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';
import { localizeHref } from '@/paraglide/runtime.js';

type PaymentViewState = 'processing' | 'success' | 'failed' | 'timeout';

export function getSafePaymentCallback(raw?: string | null): string {
  if (!raw) return Routes.History;
  try {
    const base = new URL('https://payment-callback.invalid');
    const candidate = new URL(raw, base);
    if (candidate.origin !== base.origin) return Routes.History;
    const path = `${candidate.pathname}${candidate.search}${candidate.hash}`;
    if (
      candidate.pathname === Routes.Payment ||
      candidate.pathname === Routes.SIGN_IN ||
      candidate.pathname === Routes.SIGN_UP
    ) {
      return Routes.History;
    }
    return path;
  } catch {
    return Routes.History;
  }
}

export const Route = createFileRoute('/payment')({
  validateSearch: (search: Record<string, unknown>) => ({
    session_id:
      typeof search.session_id === 'string' ? search.session_id : undefined,
    callback: typeof search.callback === 'string' ? search.callback : undefined,
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const session = await getSession();
    if (!session?.user) {
      const query = new URLSearchParams();
      if (deps.search.session_id) {
        query.set('session_id', deps.search.session_id);
      }
      query.set('callback', getSafePaymentCallback(deps.search.callback));
      const callbackUrl = `/payment?${query.toString()}`;
      throw redirect({ to: buildLoginPath({ callbackUrl }) as never });
    }
    return { userId: session.user.id };
  },
  head: () => ({
    meta: [{ title: m['payment.status.page_title']() }],
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const search = Route.useSearch();
  const router = useLocaleRouter();
  const queryClient = useQueryClient();
  const [viewState, setViewState] = useState<PaymentViewState>('processing');
  const [pollStartedAt, setPollStartedAt] = useState(() => Date.now());
  const callback = useMemo(
    () => getSafePaymentCallback(search.callback),
    [search.callback]
  );
  const paymentQuery = usePaymentCompletion(
    search.session_id ?? null,
    viewState === 'processing'
  );

  useEffect(() => {
    if (!search.session_id) {
      setViewState('failed');
      return;
    }

    const timeout = window.setTimeout(() => {
      setViewState((current) =>
        current === 'processing' ? 'timeout' : current
      );
    }, Math.max(0, PAYMENT_MAX_POLL_TIME - (Date.now() - pollStartedAt)));
    return () => window.clearTimeout(timeout);
  }, [pollStartedAt, search.session_id]);

  useEffect(() => {
    if (!paymentQuery.data || viewState !== 'processing') return;
    if (paymentQuery.data.isPaid || paymentQuery.data.status === 'paid') {
      setViewState('success');
      return;
    }
    if (
      paymentQuery.data.status === 'failed' ||
      paymentQuery.data.status === 'expired'
    ) {
      setViewState('failed');
    }
  }, [paymentQuery.data, viewState]);

  useEffect(() => {
    if (viewState !== 'success') return;
    let active = true;
    void invalidateWorkspaceAfterPaymentChange(queryClient).then(() => {
      if (!active) return;
      window.setTimeout(
        () => window.location.replace(localizeHref(callback)),
        900
      );
    });
    return () => {
      active = false;
    };
  }, [callback, queryClient, viewState]);

  const retry = async () => {
    setPollStartedAt(Date.now());
    setViewState('processing');
    await paymentQuery.refetch();
  };

  const content = {
    processing: {
      icon: <Loader2Icon className="size-12 animate-spin text-blue-600" />,
      title: m['payment.status.processing_title'](),
      description: m['payment.status.processing_description'](),
    },
    success: {
      icon: <CheckCircleIcon className="size-12 text-emerald-600" />,
      title: m['payment.status.success_title'](),
      description: m['payment.status.success_description'](),
    },
    failed: {
      icon: <XCircleIcon className="size-12 text-red-600" />,
      title: m['payment.status.failed_title'](),
      description: m['payment.status.failed_description'](),
    },
    timeout: {
      icon: <AlertCircleIcon className="size-12 text-amber-600" />,
      title: m['payment.status.timeout_title'](),
      description: m['payment.status.timeout_description'](),
    },
  }[viewState];

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-4">{content.icon}</div>
          <CardTitle>{content.title}</CardTitle>
          <CardDescription>{content.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          {(viewState === 'failed' || viewState === 'timeout') && (
            <Button type="button" onClick={retry} disabled={paymentQuery.isFetching}>
              <RefreshCwIcon className="size-4" />
              {paymentQuery.isFetching
                ? m['payment.status.retrying']()
                : m['payment.status.retry']()}
            </Button>
          )}
          {viewState !== 'processing' && (
            <Button type="button" variant="outline" onClick={() => router.replace(callback)}>
              {m['payment.status.back']()}
            </Button>
          )}
        </CardContent>
        {viewState === 'processing' && (
          <p className="px-6 pb-6 text-center text-xs text-muted-foreground">
            {m['payment.status.keep_open']({ seconds: PAYMENT_POLL_INTERVAL / 1000 })}
          </p>
        )}
      </Card>
    </main>
  );
}
