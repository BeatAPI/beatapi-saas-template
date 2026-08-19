import { useEffect, useState, type ReactNode } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, CheckCircle2, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { envConfigs } from '@/config';
import { getPricingProduct } from '@/config/pricing';
import {
  buildCheckoutPath,
  parseCheckoutIntent,
} from '@/core/checkout/checkout-intent';
import { buildLoginPath } from '@/core/workspace-lib/auth-redirect';
import { getSession } from '@/core/workspace-lib/session';
import { usePublicConfig } from '@/hooks/use-public-config';
import { apiPost } from '@/lib/api-client';

const providerLabels: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  creem: 'Creem',
  lemonsqueezy: 'Lemon Squeezy',
  paddle: 'Paddle',
  alipay: 'Alipay',
  wechat: 'WeChat Pay',
};

export const Route = createFileRoute('/checkout')({
  validateSearch: (search: Record<string, unknown>) => ({
    product: typeof search.product === 'string' ? search.product : undefined,
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const intent = parseCheckoutIntent(deps.search);
    const product = intent.productId ? getPricingProduct(intent.productId) : null;
    if (!product) return { productId: null };

    const session = await getSession();
    if (!session?.user) {
      const callbackUrl = buildCheckoutPath({
        productId: product.productId,
      });
      throw redirect({
        to: buildLoginPath({ callbackUrl }) as never,
      });
    }

    return { productId: product.productId };
  },
  head: () => ({
    meta: [
      { title: `Checkout | ${envConfigs.app_name}` },
      { name: 'description', content: `Complete your ${envConfigs.app_name} subscription.` },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { productId } = Route.useLoaderData();
  const product = productId ? getPricingProduct(productId) : null;
  const configQuery = usePublicConfig();
  const configs = configQuery.data ?? {};
  const providers = (configs.payment_provider_names || '')
    .split(',')
    .filter(Boolean);
  const defaultProvider = providers.includes(configs.default_payment_provider)
    ? configs.default_payment_provider
    : providers[0] || '';
  const [provider, setProvider] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!provider && defaultProvider) setProvider(defaultProvider);
  }, [defaultProvider, provider]);

  const checkout = useMutation({
    mutationFn: () =>
      apiPost<{ checkout_url?: string }>('/api/payment/checkout', {
        product_id: product?.productId,
        payment_provider: provider || undefined,
        redirect: '/settings/billing?checkout=success',
      }),
    onSuccess: (data) => {
      if (!data.checkout_url) {
        setError('The payment provider did not return a checkout URL.');
        return;
      }
      window.location.assign(data.checkout_url);
    },
    onError: (checkoutError: Error) => setError(checkoutError.message),
  });

  if (!product) {
    return (
      <CheckoutShell>
        <AlertCircle className="size-9 text-rose-500" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Plan not found</h1>
        <p className="mt-3 text-slate-600">Return to pricing and choose an available plan.</p>
        <a className="mt-7 inline-flex font-medium text-primary" href="/#pricing">
          View pricing
        </a>
      </CheckoutShell>
    );
  }

  const price = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: product.currency.toUpperCase(),
  }).format(product.priceInCents / 100);
  const interval = product.plan?.interval === 'year' ? 'year' : 'month';

  return (
    <CheckoutShell>
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-orange-500 text-white">
          <CreditCard className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium text-slate-500">Secure checkout</p>
          <h1 className="text-2xl font-semibold tracking-tight">{product.planName}</h1>
        </div>
      </div>

      <div className="mt-8 rounded-3xl bg-slate-50 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Subscription total</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">{price}</p>
          </div>
          <span className="pb-1 text-sm font-medium text-slate-500">/{interval}</span>
        </div>
        <div className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-5 text-sm text-slate-700">
          <CheckCircle2 className="size-4 text-emerald-500" />
          Plan access and included features
        </div>
      </div>

      {configQuery.isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Checking payment configuration…</p>
      ) : providers.length ? (
        <div className="mt-6">
          {providers.length > 1 ? (
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {providers.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setProvider(name)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                    provider === name
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {providerLabels[name] || name}
                </button>
              ))}
            </div>
          ) : null}
          <Button
            className="h-12 w-full rounded-full bg-slate-950 text-base text-white hover:bg-slate-800"
            disabled={checkout.isPending || !provider}
            onClick={() => {
              setError('');
              checkout.mutate();
            }}
          >
            {checkout.isPending ? 'Opening secure checkout…' : `Continue with ${providerLabels[provider] || provider}`}
            {!checkout.isPending ? <ArrowRight className="ml-2 size-4" /> : null}
          </Button>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-semibold">Payment setup is required</p>
          <p className="mt-1">Add a supported provider in Admin → Settings → Payment, then return here. No payment credentials are bundled in the open-source template.</p>
          <a className="mt-3 inline-flex font-semibold underline" href="/admin/settings">Open payment settings</a>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      <p className="mt-6 text-center text-xs text-slate-400">Payments are processed by your configured provider. BeatAPI does not store card details.</p>
    </CheckoutShell>
  );
}

function CheckoutShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f5fa] px-5 py-16 text-slate-950">
      <section className="w-full max-w-xl rounded-[36px] bg-white p-7 shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:p-10">
        {children}
      </section>
    </main>
  );
}
