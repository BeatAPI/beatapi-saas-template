import { createFileRoute } from '@tanstack/react-router';
import { respData } from '@/lib/resp';
import { getAllConfigs, filterPublicConfigs } from '@/modules/config/service';
import { getConfiguredPaymentProviderNames } from '@/modules/payment/provider-config';
import { hasConfiguredEmailProvider } from '@/core/email/configured';

const publicKeys = [
  'email_auth_enabled',
  'google_auth_enabled',
  'google_one_tap_enabled',
  'google_client_id',
  'invite_code_required',
  'crisp_enabled',
  'turnstile_enabled',
  'turnstile_site_key',
  'select_payment_enabled',
  'default_payment_provider',
  'stripe_enabled',
  'creem_enabled',
  'lemonsqueezy_enabled',
  'paddle_enabled',
  'paypal_enabled',
  'alipay_enabled',
  'wechat_enabled',
  'google_analytics_id',
  'plausible_domain',
  'plausible_src',
];

async function GET({ request }: { request: Request }) {
  const configs = await getAllConfigs();
  const result = filterPublicConfigs(configs, publicKeys);
  const paymentProviders = getConfiguredPaymentProviderNames(configs);
  for (const provider of [
    'stripe',
    'creem',
    'lemonsqueezy',
    'paddle',
    'paypal',
    'alipay',
    'wechat',
  ]) {
    result[`${provider}_enabled`] = paymentProviders.includes(provider)
      ? 'true'
      : 'false';
  }
  result.payment_checkout_enabled = paymentProviders.length ? 'true' : 'false';
  result.payment_provider_names = paymentProviders.join(',');
  result.password_reset_enabled =
    configs.email_auth_enabled !== 'false' &&
    hasConfiguredEmailProvider(configs)
      ? 'true'
      : 'false';
  result.email_verification_enabled =
    configs.email_verification_enabled === 'true' &&
    hasConfiguredEmailProvider(configs)
      ? 'true'
      : 'false';
  return respData(result);
}

export const Route = createFileRoute('/api/config/public')({
  server: {
    handlers: { GET },
  },
});
