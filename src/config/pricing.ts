/**
 * Compatibility catalog for the generic /api/payment/checkout route.
 *
 * The public BeatAPI purchase surface is the lazy pricing card/modal backed by
 * websiteConfig.credits.packages + ZPAY checkout. This file must not reintroduce
 * standalone SaaS subscriptions; keep it aligned to one-time credit packs only.
 */

import { PaymentInterval, PaymentType } from '@/core/payment/types';

export type PricingPlanInfo = {
  name: string;
  interval: PaymentInterval;
  intervalCount: number;
};

export type PricingProduct = {
  productId: string;
  productName: string;
  planName: string;
  description: string;
  type: PaymentType;
  priceInCents: number;
  currency: string;
  credits: number;
  creditsValidDays?: number;
  plan?: PricingPlanInfo;
};

export const pricingCatalog: Record<string, PricingProduct> = {
  beatapi_starter_monthly: {
    productId: 'beatapi_starter_monthly',
    productName: 'Starter',
    planName: 'Starter Monthly',
    description: 'BeatAPI Starter plan — 275 credits per month',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 1900,
    currency: 'usd',
    credits: 275,
    creditsValidDays: 45,
    plan: { name: 'Starter', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },
  beatapi_starter_yearly: {
    productId: 'beatapi_starter_yearly',
    productName: 'Starter',
    planName: 'Starter Yearly',
    description: 'BeatAPI Starter plan — billed annually',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 15900,
    currency: 'usd',
    credits: 3300,
    creditsValidDays: 380,
    plan: { name: 'Starter', interval: PaymentInterval.YEAR, intervalCount: 1 },
  },
  beatapi_plus_monthly: {
    productId: 'beatapi_plus_monthly',
    productName: 'Plus',
    planName: 'Plus Monthly',
    description: 'BeatAPI Plus plan — 800 credits per month',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 3900,
    currency: 'usd',
    credits: 800,
    creditsValidDays: 45,
    plan: { name: 'Plus', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },
  beatapi_plus_yearly: {
    productId: 'beatapi_plus_yearly',
    productName: 'Plus',
    planName: 'Plus Yearly',
    description: 'BeatAPI Plus plan — billed annually',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 32700,
    currency: 'usd',
    credits: 9600,
    creditsValidDays: 380,
    plan: { name: 'Plus', interval: PaymentInterval.YEAR, intervalCount: 1 },
  },
  beatapi_pro_monthly: {
    productId: 'beatapi_pro_monthly',
    productName: 'Pro',
    planName: 'Pro Monthly',
    description: 'BeatAPI Pro plan — 1,800 credits per month',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 7900,
    currency: 'usd',
    credits: 1800,
    creditsValidDays: 45,
    plan: { name: 'Pro', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },
  beatapi_pro_yearly: {
    productId: 'beatapi_pro_yearly',
    productName: 'Pro',
    planName: 'Pro Yearly',
    description: 'BeatAPI Pro plan — billed annually',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 66300,
    currency: 'usd',
    credits: 21600,
    creditsValidDays: 380,
    plan: { name: 'Pro', interval: PaymentInterval.YEAR, intervalCount: 1 },
  },
  beatapi_max_monthly: {
    productId: 'beatapi_max_monthly',
    productName: 'Max',
    planName: 'Max Monthly',
    description: 'BeatAPI Max plan — 3,800 credits per month',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 14900,
    currency: 'usd',
    credits: 3800,
    creditsValidDays: 45,
    plan: { name: 'Max', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },
  beatapi_max_yearly: {
    productId: 'beatapi_max_yearly',
    productName: 'Max',
    planName: 'Max Yearly',
    description: 'BeatAPI Max plan — billed annually',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 125100,
    currency: 'usd',
    credits: 45600,
    creditsValidDays: 380,
    plan: { name: 'Max', interval: PaymentInterval.YEAR, intervalCount: 1 },
  },
  credits_basic: {
    productId: 'credits_basic',
    productName: 'Basic Credits',
    planName: 'Basic Credits',
    description: 'One-time credit pack: 300 credits',
    type: PaymentType.ONE_TIME,
    priceInCents: 3900,
    currency: 'cny',
    credits: 300,
  },
  credits_standard: {
    productId: 'credits_standard',
    productName: 'Advanced Credits',
    planName: 'Advanced Credits',
    description: 'One-time credit pack: 1,500 credits',
    type: PaymentType.ONE_TIME,
    priceInCents: 14900,
    currency: 'cny',
    credits: 1500,
  },
  credits_premium: {
    productId: 'credits_premium',
    productName: 'Expert Credits',
    planName: 'Expert Credits',
    description: 'One-time credit pack: 6,000 credits',
    type: PaymentType.ONE_TIME,
    priceInCents: 49900,
    currency: 'cny',
    credits: 6000,
  },
};

export function getPricingProduct(productId: string): PricingProduct | null {
  if (!productId) return null;
  return pricingCatalog[productId] ?? null;
}

export function listPricingProducts(): PricingProduct[] {
  return Object.values(pricingCatalog);
}
