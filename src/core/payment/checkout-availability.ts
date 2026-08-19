export function isGenericPaymentCheckoutEnabled(
  configs: Record<string, string | undefined>
): boolean {
  if (configs.generic_payment_enabled === 'true') return true;
  if (configs.generic_payment_enabled === 'false') return false;

  const stripeKey = configs.stripe_secret_key || configs.stripe_api_key;
  const hasStripe = configs.stripe_enabled === 'true' && !!stripeKey;
  const hasCreem =
    configs.creem_enabled === 'true' && !!configs.creem_api_key;
  const hasPayPal =
    configs.paypal_enabled === 'true' &&
    !!configs.paypal_client_id &&
    !!configs.paypal_client_secret;
  const hasAlipay =
    configs.alipay_enabled === 'true' &&
    !!configs.alipay_app_id &&
    !!configs.alipay_private_key &&
    !!configs.alipay_public_key;
  const hasWechat =
    configs.wechat_enabled === 'true' &&
    !!configs.wechat_app_id &&
    !!configs.wechat_mch_id &&
    !!configs.wechat_api_v3_key &&
    !!configs.wechat_private_key &&
    !!configs.wechat_serial_no;

  return hasStripe || hasCreem || hasPayPal || hasAlipay || hasWechat;
}
