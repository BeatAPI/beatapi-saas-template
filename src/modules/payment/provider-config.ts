import {
  AlipayProvider,
  CreemProvider,
  LemonSqueezyProvider,
  PaddleProvider,
  PayPalProvider,
  PaymentManager,
  StripeProvider,
  WechatPayProvider,
} from '@/core/payment';

type Configs = Record<string, string>;

const enabled = (configs: Configs, key: string) => configs[key] === 'true';

export function getConfiguredPaymentProviderNames(configs: Configs): string[] {
  const names: string[] = [];
  const stripeKey = configs.stripe_secret_key || configs.stripe_api_key;

  if (enabled(configs, 'stripe_enabled') && stripeKey) names.push('stripe');
  if (enabled(configs, 'creem_enabled') && configs.creem_api_key) names.push('creem');
  if (
    enabled(configs, 'lemonsqueezy_enabled') &&
    configs.lemonsqueezy_api_key &&
    configs.lemonsqueezy_store_id &&
    configs.lemonsqueezy_signing_secret
  ) {
    names.push('lemonsqueezy');
  }
  if (
    enabled(configs, 'paddle_enabled') &&
    configs.paddle_api_key &&
    configs.paddle_webhook_secret
  ) {
    names.push('paddle');
  }
  if (
    enabled(configs, 'paypal_enabled') &&
    configs.paypal_client_id &&
    configs.paypal_client_secret
  ) {
    names.push('paypal');
  }
  if (
    enabled(configs, 'alipay_enabled') &&
    configs.alipay_app_id &&
    configs.alipay_private_key &&
    configs.alipay_public_key
  ) {
    names.push('alipay');
  }
  if (
    enabled(configs, 'wechat_enabled') &&
    configs.wechat_app_id &&
    configs.wechat_mch_id &&
    configs.wechat_api_v3_key &&
    configs.wechat_private_key &&
    configs.wechat_serial_no
  ) {
    names.push('wechat');
  }

  return names;
}

export function paymentManagerConfigFingerprint(configs: Configs): string {
  return JSON.stringify({
    providers: getConfiguredPaymentProviderNames(configs),
    default: configs.default_payment_provider || '',
    stripe: [
      configs.stripe_secret_key || configs.stripe_api_key || '',
      configs.stripe_publishable_key || '',
      configs.stripe_signing_secret || configs.stripe_webhook_secret || '',
    ],
    creem: [configs.creem_api_key || '', configs.creem_environment || ''],
    lemonsqueezy: [
      configs.lemonsqueezy_api_key || '',
      configs.lemonsqueezy_store_id || '',
      configs.lemonsqueezy_signing_secret || '',
      configs.lemonsqueezy_test_mode || '',
    ],
    paddle: [
      configs.paddle_api_key || '',
      configs.paddle_webhook_secret || '',
      configs.paddle_environment || '',
    ],
    paypal: [
      configs.paypal_client_id || '',
      configs.paypal_client_secret || '',
      configs.paypal_environment || '',
    ],
    alipay: [configs.alipay_app_id || '', configs.alipay_private_key || ''],
    wechat: [configs.wechat_mch_id || '', configs.wechat_private_key || ''],
  });
}

export function buildPaymentManager(configs: Configs): PaymentManager {
  const manager = new PaymentManager();
  const isDefault = (name: string) =>
    configs.default_payment_provider
      ? configs.default_payment_provider === name
      : name === 'stripe';
  const providerNames = getConfiguredPaymentProviderNames(configs);
  const stripeKey = configs.stripe_secret_key || configs.stripe_api_key;

  if (providerNames.includes('stripe')) {
    manager.addProvider(
      new StripeProvider({
        secretKey: stripeKey,
        publishableKey: configs.stripe_publishable_key || '',
        signingSecret:
          configs.stripe_signing_secret ||
          configs.stripe_webhook_secret ||
          undefined,
        allowPromotionCodes: configs.stripe_allow_promotion_codes !== 'false',
        allowedPaymentMethods: ['card'],
      }),
      isDefault('stripe')
    );
  }

  if (providerNames.includes('creem')) {
    manager.addProvider(
      new CreemProvider({
        apiKey: configs.creem_api_key,
        signingSecret: configs.creem_signing_secret || undefined,
        environment:
          configs.creem_environment === 'production' ? 'production' : 'sandbox',
      }),
      isDefault('creem')
    );
  }

  if (providerNames.includes('lemonsqueezy')) {
    manager.addProvider(
      new LemonSqueezyProvider({
        apiKey: configs.lemonsqueezy_api_key,
        storeId: configs.lemonsqueezy_store_id,
        signingSecret: configs.lemonsqueezy_signing_secret,
        testMode: configs.lemonsqueezy_test_mode === 'true',
      }),
      isDefault('lemonsqueezy')
    );
  }

  if (providerNames.includes('paddle')) {
    manager.addProvider(
      new PaddleProvider({
        apiKey: configs.paddle_api_key,
        webhookSecret: configs.paddle_webhook_secret,
        environment:
          configs.paddle_environment === 'production' ? 'production' : 'sandbox',
      }),
      isDefault('paddle')
    );
  }

  if (providerNames.includes('paypal')) {
    manager.addProvider(
      new PayPalProvider({
        clientId: configs.paypal_client_id,
        clientSecret: configs.paypal_client_secret,
        webhookId: configs.paypal_webhook_id || undefined,
        environment:
          configs.paypal_environment === 'production' ||
          configs.paypal_environment === 'live'
            ? 'production'
            : 'sandbox',
      }),
      isDefault('paypal')
    );
  }

  if (providerNames.includes('alipay')) {
    manager.addProvider(
      new AlipayProvider({
        appId: configs.alipay_app_id,
        privateKey: configs.alipay_private_key,
        alipayPublicKey: configs.alipay_public_key,
        notifyUrl: configs.alipay_notify_url || undefined,
      }),
      isDefault('alipay')
    );
  }

  if (providerNames.includes('wechat')) {
    manager.addProvider(
      new WechatPayProvider({
        appId: configs.wechat_app_id,
        mchId: configs.wechat_mch_id,
        apiV3Key: configs.wechat_api_v3_key,
        privateKey: configs.wechat_private_key,
        serialNo: configs.wechat_serial_no,
        notifyUrl: configs.wechat_notify_url || undefined,
        platformCert: configs.wechat_platform_cert || undefined,
      }),
      isDefault('wechat')
    );
  }

  return manager;
}
