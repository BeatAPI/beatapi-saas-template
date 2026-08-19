export const beatapiPlanIds = ['starter', 'plus', 'pro', 'max'] as const;
export const checkoutBillingPeriods = ['monthly', 'yearly'] as const;

export type BeatAPIPlanId = (typeof beatapiPlanIds)[number];
export type CheckoutBillingPeriod = (typeof checkoutBillingPeriods)[number];

const knownProductIds = new Set([
  'credits_basic',
  'credits_standard',
  'credits_premium',
  ...beatapiPlanIds.flatMap((plan) =>
    checkoutBillingPeriods.map((period) => `beatapi_${plan}_${period}`)
  ),
]);

export function getBeatAPIProductId(
  plan: BeatAPIPlanId,
  period: CheckoutBillingPeriod
) {
  return `beatapi_${plan}_${period}`;
}

export function buildCheckoutPath({
  productId,
}: {
  productId: string;
}) {
  const params = new URLSearchParams({ product: productId });
  return `/checkout?${params.toString()}`;
}

export function parseCheckoutIntent(search: Record<string, unknown>): {
  productId: string | null;
} {
  const product = typeof search.product === 'string' ? search.product : '';

  return {
    productId: knownProductIds.has(product) ? product : null,
  };
}
