import { PaymentTypes, PlanIntervals } from '@/core/workspace-lib/payment/types';
import type { WebsiteConfig } from '@/core/workspace-lib/types/index';

export const APP_BRAND_NAME = 'BeatAPI';
export const APP_DESCRIPTION =
  'Infinite canvas AI image and video generation workspace.';

const metaEnv: Record<string, string | undefined> =
  (import.meta as any).env ?? {};
const procEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

const publicEnv = (key: string) => metaEnv[key] ?? procEnv[key];
const isPublicFlagEnabled = (...keys: string[]) =>
  keys.some((key) => publicEnv(key) === 'true');

/**
 * BeatAPI product config, without translations.
 */
export const websiteConfig: WebsiteConfig = {
  ui: {
    mode: {
      defaultMode: 'light',
      enableSwitch: false,
    },
  },
  metadata: {
    images: {
      ogImage: '/logo.png',
      logoLight: '/logo.png',
      logoDark: '/logo.png',
    },
    social: {},
  },
  features: {
    enableUpgradeCard: true,
    enableUpdateAvatar: true,
    enableAffonsoAffiliate: false,
    enablePromotekitAffiliate: false,
    enableDatafastRevenueTrack: false,
    enableCrispChat: isPublicFlagEnabled(
      'VITE_CRISP_ENABLED',
      'VITE_DEMO_WEBSITE'
    ),
    enableTurnstileCaptcha: isPublicFlagEnabled(
      'VITE_TURNSTILE_ENABLED',
      'VITE_DEMO_WEBSITE'
    ),
  },
  routes: {
    defaultLoginRedirect: '/',
  },
  analytics: {
    enableVercelAnalytics: false,
    enableSpeedInsights: false,
  },
  auth: {
    enableGoogleLogin: true,
    enableGoogleOneTap: isPublicFlagEnabled('VITE_GOOGLE_ONE_TAP_ENABLED'),
    enableGithubLogin: false,
    enableCredentialLogin: true,
  },
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: {
        flag: '🇺🇸',
        name: 'English',
        hreflang: 'en',
      },
      zh: {
        flag: '🇨🇳',
        name: '中文',
        hreflang: 'zh-CN',
      },
    },
  },
  blog: {
    enable: false,
    paginationSize: 6,
    relatedPostsSize: 3,
  },
  docs: {
    enable: false,
  },
  mail: {
    provider: 'resend',
    fromEmail: 'BeatAPI <support@your-domain.com>',
    supportEmail: 'BeatAPI <support@your-domain.com>',
  },
  newsletter: {
    enable: false,
    provider: 'resend',
    autoSubscribeAfterSignUp: true,
  },
  storage: {
    enable: true,
    provider: 's3',
  },
  payment: {
    provider: 'zpay',
  },
  price: {
    plans: {
      free: {
        id: 'free',
        prices: [],
        isFree: true,
        isLifetime: false,
        credits: {
          enable: false,
          amount: 50,
        },
      },
      basic: {
        id: 'basic',
        name: 'Basic',
        prices: [
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: 'disabled-subscription:basic:monthly',
            amount: 900,
            currency: 'USD',
            interval: PlanIntervals.MONTH,
          },
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: 'disabled-subscription:basic:yearly',
            amount: 10800,
            currency: 'USD',
            interval: PlanIntervals.YEAR,
          },
        ],
        isFree: false,
        isLifetime: false,
        credits: {
          enable: true,
          amount: 150,
        },
      },
      pro: {
        id: 'pro',
        name: 'Pro',
        prices: [
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: 'disabled-subscription:pro:monthly',
            amount: 2900,
            currency: 'USD',
            interval: PlanIntervals.MONTH,
          },
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: 'disabled-subscription:pro:yearly',
            amount: 27840,
            currency: 'USD',
            interval: PlanIntervals.YEAR,
          },
        ],
        isFree: false,
        isLifetime: false,
        credits: {
          enable: true,
          amount: 600,
        },
      },
      creator: {
        id: 'creator',
        name: 'Creator',
        prices: [
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: 'disabled-subscription:creator:monthly',
            amount: 5900,
            currency: 'USD',
            interval: PlanIntervals.MONTH,
          },
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: 'disabled-subscription:creator:yearly',
            amount: 56640,
            currency: 'USD',
            interval: PlanIntervals.YEAR,
          },
        ],
        isFree: false,
        isLifetime: false,
        popular: true,
        credits: {
          enable: true,
          amount: 1500,
        },
      },
      elite: {
        id: 'elite',
        name: 'Elite',
        prices: [
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: 'disabled-subscription:elite:monthly',
            amount: 17900,
            currency: 'USD',
            interval: PlanIntervals.MONTH,
          },
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: 'disabled-subscription:elite:yearly',
            amount: 171840,
            currency: 'USD',
            interval: PlanIntervals.YEAR,
          },
        ],
        isFree: false,
        isLifetime: false,
        credits: {
          enable: true,
          amount: 5200,
        },
      },
    },
  },
  credits: {
    enableCredits: true,
    enablePackagesForFreePlan: false,
    registerGiftCredits: {
      enable: true,
      amount: 10,
    },
    packages: {
      basic: {
        id: 'basic',
        amount: 300,
        price: {
          priceId: 'zpay:credits:basic',
          amount: 3900,
          currency: 'CNY',
        },
        popular: false,
      },
      standard: {
        id: 'standard',
        amount: 1500,
        price: {
          priceId: 'zpay:credits:standard',
          amount: 14_900,
          currency: 'CNY',
        },
        popular: true,
      },
      premium: {
        id: 'premium',
        amount: 6000,
        price: {
          priceId: 'zpay:credits:premium',
          amount: 49_900,
          currency: 'CNY',
        },
        popular: false,
      },
    },
  },
};
