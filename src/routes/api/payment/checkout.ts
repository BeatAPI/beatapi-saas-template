import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr, respInternalError, respUnauthorized } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { createCheckout } from '@/modules/payment/service';
import { envConfigs } from '@/config';
import { getAllConfigs } from '@/modules/config/service';
import { getPricingProduct } from '@/config/pricing';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { isGenericPaymentCheckoutEnabled } from '@/core/payment/checkout-availability';
import { resolveProviderProductId } from '@/core/payment/provider-catalog';

function safeSameOriginPath(input: string | undefined | null, fallbackPath: string): string {
  if (!input) return fallbackPath;
  try {
    const appUrl = new URL(envConfigs.app_url || 'http://localhost:3020');
    const candidate = new URL(input, appUrl);
    if (candidate.origin !== appUrl.origin) return fallbackPath;
    return candidate.pathname + candidate.search + candidate.hash;
  } catch {
    return fallbackPath;
  }
}

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, { intervalMs: 1000, keyPrefix: 'checkout' });
  if (limited) return limited;

  try {
    const configs = await getAllConfigs();
    if (!isGenericPaymentCheckoutEnabled(configs)) {
      return respErr('Not found', 404);
    }

    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return respUnauthorized();
    }

    const body = await request.json().catch(() => ({}));
    const { product_id, payment_provider, redirect } = body;

    if (!product_id || typeof product_id !== 'string') {
      return respErr('Missing product_id');
    }

    // Look up product in the authoritative server-side catalog.
    // We DO NOT trust price / credits / plan from the request body.
    const product = getPricingProduct(product_id);
    if (!product) {
      return respErr('Unknown product', 404);
    }

    // Optional per-provider "test amount" override (admin-configured).
    // Only the charged amount is overridden — credits granted and order
    // amount stored both come from the authoritative catalog.
    const providerKey = payment_provider || configs.default_payment_provider || 'stripe';
    const testAmountRaw = providerKey ? configs[`${providerKey}_test_amount`] : undefined;
    const testAmount = testAmountRaw ? parseInt(testAmountRaw) : 0;
    const chargeAmount = testAmount > 0 ? testAmount : product.priceInCents;

    // Build success/cancel URLs — only accept same-origin redirects.
    const baseUrl = envConfigs.app_url || 'http://localhost:3020';
    const safeRedirectPath = safeSameOriginPath(redirect, '/settings/billing');
    const finalRedirect = `${baseUrl}${safeRedirectPath}`;
    const successUrl = finalRedirect;
    const cancelUrl = `${baseUrl}/pricing`;

    const checkout = await createCheckout({
      userId: session.user.id,
      userEmail: session.user.email,
      localProductId: product.productId,
      productName: product.productName,
      planName: product.planName,
      credits: product.credits,
      creditsValidDays: product.creditsValidDays,
      paymentOrder: {
        productId: resolveProviderProductId({
          localProductId: product.productId,
          provider: providerKey,
          configs,
        }),
        price: { amount: chargeAmount, currency: product.currency },
        type: product.type,
        description: product.description,
        successUrl,
        cancelUrl,
        customer: {
          email: session.user.email,
          name: session.user.name,
        },
        plan: product.plan
          ? {
              name: product.plan.name,
              interval: product.plan.interval,
              intervalCount: product.plan.intervalCount,
            }
          : undefined,
      },
      provider: providerKey,
    });

    return respData({ checkout_url: checkout.checkoutInfo.checkoutUrl });
  } catch (error: any) {
    console.error('checkout error:', error);
    return respInternalError('Checkout failed');
  }
}

export const Route = createFileRoute('/api/payment/checkout')({
  server: {
    handlers: { POST },
  },
});
