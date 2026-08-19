
import type { PricePlan } from '@/core/workspace-lib/types';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { websiteConfig } from './website';

/**
 * Get price plans with translations for client components
 *
 * NOTICE: This function should only be used in client components.
 * If you need to get the price plans in server components, use getAllPricePlans instead.
 * Use this function when showing the pricing table or the billing card to the user.
 *
 * docs:
 * BeatAPI internal docs
 *
 * @returns The price plans with translated content
 */
export function usePricePlans(): Record<string, PricePlan> {
  const t = useTranslations('PricePlans');
  const raw = (t as unknown as { raw: (key: string) => unknown }).raw;
  const priceConfig = websiteConfig.price;
  const plans: Record<string, PricePlan> = {};

  const getFeatures = (key: string) => {
    const value = raw(`${key}.features`);
    if (!value || typeof value !== 'object') {
      return [];
    }
    return Object.values(value as Record<string, string>);
  };

  const getLimits = (key: string) => {
    const value = raw(`${key}.limits`);
    if (!value || typeof value !== 'object') {
      return [];
    }
    return Object.values(value as Record<string, string>);
  };

  // Add translated content to each plan
  if (priceConfig.plans.free) {
    plans.free = {
      ...priceConfig.plans.free,
      name: t('free.name'),
      description: t('free.description'),
      features: [
        t('free.features.feature-1'),
        t('free.features.feature-2'),
        t('free.features.feature-3'),
        t('free.features.feature-4'),
      ],
      limits: [
        t('free.limits.limit-1'),
        t('free.limits.limit-2'),
        t('free.limits.limit-3'),
      ],
    };
  }

  if (priceConfig.plans.pro) {
    plans.pro = {
      ...priceConfig.plans.pro,
      name: t('pro.name'),
      description: t('pro.description'),
      features: getFeatures('pro'),
      limits: getLimits('pro'),
    };
  }

  if (priceConfig.plans.basic) {
    plans.basic = {
      ...priceConfig.plans.basic,
      name: t('basic.name'),
      description: t('basic.description'),
      features: getFeatures('basic'),
      limits: getLimits('basic'),
    };
  }

  if (priceConfig.plans.creator) {
    plans.creator = {
      ...priceConfig.plans.creator,
      name: t('creator.name'),
      description: t('creator.description'),
      features: getFeatures('creator'),
      limits: getLimits('creator'),
    };
  }

  if (priceConfig.plans.elite) {
    plans.elite = {
      ...priceConfig.plans.elite,
      name: t('elite.name'),
      description: t('elite.description'),
      features: getFeatures('elite'),
      limits: getLimits('elite'),
    };
  }

  if (priceConfig.plans.lifetime) {
    plans.lifetime = {
      ...priceConfig.plans.lifetime,
      name: t('lifetime.name'),
      description: t('lifetime.description'),
      features: [
        t('lifetime.features.feature-1'),
        t('lifetime.features.feature-2'),
        t('lifetime.features.feature-3'),
        t('lifetime.features.feature-4'),
        t('lifetime.features.feature-5'),
        t('lifetime.features.feature-6'),
        t('lifetime.features.feature-7'),
      ],
      limits: [],
    };
  }

  return plans;
}
