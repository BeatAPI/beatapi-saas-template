/**
 * Settings definitions — tabs, groups, and fields.
 *
 * This drives the admin settings UI. Add new settings here
 * and they'll automatically appear in the admin panel.
 */

export interface Setting {
  name: string;
  title: string;
  type: 'text' | 'password' | 'textarea' | 'number' | 'switch' | 'select';
  placeholder?: string;
  options?: { label: string; value: string }[];
  tip?: string;
  group: string;
  tab: string;
  defaultValue?: string;
}

export interface SettingGroup {
  name: string;
  title: string;
  description?: string;
  tab: string;
}

export interface SettingTab {
  name: string;
  title: string;
}

export function getSettingTabs(): SettingTab[] {
  return [
    { name: 'general', title: 'General' },
    { name: 'auth', title: 'Auth' },
    { name: 'payment', title: 'Payment' },
    { name: 'email', title: 'Email' },
    { name: 'storage', title: 'Storage' },
    { name: 'ai', title: 'AI' },
    { name: 'analytics', title: 'Analytics' },
  ];
}

export function getSettingGroups(): SettingGroup[] {
  return [
    // General
    { name: 'appinfo', title: 'App Info', description: 'Basic application settings', tab: 'general' },
    { name: 'user_role', title: 'User Roles', description: 'Default role for new users', tab: 'general' },
    { name: 'credit', title: 'Credits', description: 'Initial credits for new users', tab: 'general' },

    // Auth
    { name: 'email_auth', title: 'Email Auth', description: 'Email/password authentication', tab: 'auth' },
    { name: 'google_auth', title: 'Google Auth', description: 'Google OAuth login', tab: 'auth' },

    // Payment
    { name: 'basic_payment', title: 'Basic', description: 'Payment general settings', tab: 'payment' },
    { name: 'stripe', title: 'Stripe', description: 'Stripe payment gateway', tab: 'payment' },
    { name: 'creem', title: 'Creem', description: 'Creem payment gateway', tab: 'payment' },
    { name: 'lemonsqueezy', title: 'Lemon Squeezy', description: 'Hosted checkout and merchant-of-record billing', tab: 'payment' },
    { name: 'paddle', title: 'Paddle', description: 'Paddle Billing merchant-of-record gateway', tab: 'payment' },
    { name: 'paypal', title: 'PayPal', description: 'PayPal payment gateway', tab: 'payment' },
    { name: 'alipay', title: 'Alipay', description: 'Alipay payment gateway (native)', tab: 'payment' },
    { name: 'wechat', title: 'WeChat Pay', description: 'WeChat Pay gateway (native)', tab: 'payment' },

    // Email
    { name: 'basic_email', title: 'Basic', description: 'Email provider selection', tab: 'email' },
    { name: 'resend', title: 'Resend', description: 'Default transactional email service', tab: 'email' },
    { name: 'mailgun', title: 'Mailgun', description: 'Optional Mailgun HTTP API adapter', tab: 'email' },

    // Storage
    { name: 'r2', title: 'Cloudflare R2', description: 'Uploads and generated output storage', tab: 'storage' },

    // AI generation
    { name: 'beatapi', title: 'BeatAPI', description: 'Built-in image and video generation upstream', tab: 'ai' },

    // Analytics
    { name: 'google_analytics', title: 'Google Analytics', description: 'Inject gtag.js with the configured Measurement ID', tab: 'analytics' },
    { name: 'plausible', title: 'Plausible', description: 'Inject plausible.js for self-hosted or cloud Plausible', tab: 'analytics' },
  ];
}

export function getSettings(): Setting[] {
  return [
    // ─── General / App Info ──────────────────────────────────────────
    { name: 'app_name', title: 'App Name', type: 'text', placeholder: 'BeatAPI', group: 'appinfo', tab: 'general' },
    { name: 'app_description', title: 'App Description', type: 'textarea', placeholder: 'AI product powered by BeatAPI', group: 'appinfo', tab: 'general' },
    { name: 'app_url', title: 'App URL', type: 'text', placeholder: 'https://example.com', group: 'appinfo', tab: 'general' },

    // ─── General / User Roles ────────────────────────────────────────
    { name: 'initial_role_enabled', title: 'Auto-assign role for new users', type: 'switch', group: 'user_role', tab: 'general' },
    { name: 'initial_role_name', title: 'Default role name', type: 'text', placeholder: 'viewer', group: 'user_role', tab: 'general' },

    // ─── General / Credits ───────────────────────────────────────────
    { name: 'initial_credits_enabled', title: 'Grant credits on signup', type: 'switch', group: 'credit', tab: 'general' },
    { name: 'initial_credits_amount', title: 'Credits amount', type: 'number', placeholder: '100', group: 'credit', tab: 'general' },
    { name: 'initial_credits_valid_days', title: 'Valid days', type: 'number', placeholder: '365', group: 'credit', tab: 'general' },
    { name: 'initial_credits_description', title: 'Description', type: 'text', placeholder: 'Welcome bonus', group: 'credit', tab: 'general' },

    // ─── Auth / Email ────────────────────────────────────────────────
    { name: 'email_auth_enabled', title: 'Enable email auth', type: 'switch', group: 'email_auth', tab: 'auth', defaultValue: 'true' },
    { name: 'email_verification_enabled', title: 'Require email verification on sign up', type: 'switch', group: 'email_auth', tab: 'auth', defaultValue: 'true' },
    { name: 'invite_code_required', title: 'Require invite code on sign up', type: 'switch', group: 'email_auth', tab: 'auth', defaultValue: 'false' },

    // ─── Auth / Google ───────────────────────────────────────────────
    { name: 'google_auth_enabled', title: 'Enable Google auth', type: 'switch', group: 'google_auth', tab: 'auth' },
    { name: 'google_one_tap_enabled', title: 'Enable Google One Tap', type: 'switch', group: 'google_auth', tab: 'auth', tip: 'Show the Google One Tap prompt to signed-out visitors. Requires Client ID.' },
    { name: 'google_client_id', title: 'Client ID', type: 'text', placeholder: 'xxx.apps.googleusercontent.com', group: 'google_auth', tab: 'auth' },
    { name: 'google_client_secret', title: 'Client Secret', type: 'password', placeholder: 'GOCSPX-xxx', group: 'google_auth', tab: 'auth' },

    // ─── Payment / Basic ─────────────────────────────────────────────
    { name: 'select_payment_enabled', title: 'Show payment method selector', type: 'switch', group: 'basic_payment', tab: 'payment' },
    { name: 'payment_catalog_json', title: 'Provider Catalog Map', type: 'textarea', placeholder: '{"beatapi_starter_monthly":{"creem":"prod_xxx","lemonsqueezy":"123","paddle":"pri_xxx"}}', group: 'basic_payment', tab: 'payment', tip: 'Map local plan IDs to provider product, variant, plan, or price IDs.' },
    {
      name: 'default_payment_provider', title: 'Default provider', type: 'select',
      options: [
        { label: 'Stripe', value: 'stripe' },
        { label: 'Creem', value: 'creem' },
        { label: 'Lemon Squeezy', value: 'lemonsqueezy' },
        { label: 'Paddle', value: 'paddle' },
        { label: 'PayPal', value: 'paypal' },
        { label: 'Alipay', value: 'alipay' },
        { label: 'WeChat Pay', value: 'wechat' },
      ],
      group: 'basic_payment', tab: 'payment',
    },

    // ─── Payment / Stripe ────────────────────────────────────────────
    { name: 'stripe_enabled', title: 'Enable Stripe', type: 'switch', group: 'stripe', tab: 'payment' },
    { name: 'stripe_publishable_key', title: 'Publishable Key', type: 'text', placeholder: 'pk_test_...', group: 'stripe', tab: 'payment' },
    { name: 'stripe_secret_key', title: 'Secret Key', type: 'password', placeholder: 'sk_test_...', group: 'stripe', tab: 'payment' },
    { name: 'stripe_signing_secret', title: 'Webhook Signing Secret', type: 'password', placeholder: 'whsec_...', group: 'stripe', tab: 'payment' },

    // ─── Payment / Creem ─────────────────────────────────────────────
    { name: 'creem_enabled', title: 'Enable Creem', type: 'switch', group: 'creem', tab: 'payment' },
    {
      name: 'creem_environment', title: 'Environment', type: 'select',
      options: [
        { label: 'Sandbox', value: 'sandbox' },
        { label: 'Production', value: 'production' },
      ],
      group: 'creem', tab: 'payment', defaultValue: 'sandbox',
    },
    { name: 'creem_api_key', title: 'API Key', type: 'password', placeholder: 'creem_xxx', group: 'creem', tab: 'payment' },
    { name: 'creem_signing_secret', title: 'Signing Secret', type: 'password', placeholder: 'whsec_xxx', group: 'creem', tab: 'payment' },
    { name: 'creem_test_amount', title: 'Test amount (cents)', type: 'number', placeholder: 'Leave empty to use the real amount; enter 1 to pay $0.01', group: 'creem', tab: 'payment' },

    // ─── Payment / Lemon Squeezy ─────────────────────────────────────
    { name: 'lemonsqueezy_enabled', title: 'Enable Lemon Squeezy', type: 'switch', group: 'lemonsqueezy', tab: 'payment' },
    { name: 'lemonsqueezy_api_key', title: 'API Key', type: 'password', placeholder: 'eyJ...', group: 'lemonsqueezy', tab: 'payment' },
    { name: 'lemonsqueezy_store_id', title: 'Store ID', type: 'text', placeholder: '12345', group: 'lemonsqueezy', tab: 'payment' },
    { name: 'lemonsqueezy_signing_secret', title: 'Webhook Signing Secret', type: 'password', placeholder: 'secret', group: 'lemonsqueezy', tab: 'payment' },
    { name: 'lemonsqueezy_test_mode', title: 'Test Mode', type: 'switch', group: 'lemonsqueezy', tab: 'payment', defaultValue: 'true' },

    // ─── Payment / Paddle ────────────────────────────────────────────
    { name: 'paddle_enabled', title: 'Enable Paddle', type: 'switch', group: 'paddle', tab: 'payment' },
    { name: 'paddle_api_key', title: 'API Key', type: 'password', placeholder: 'pdl_sdbx_apikey_...', group: 'paddle', tab: 'payment' },
    { name: 'paddle_webhook_secret', title: 'Webhook Secret', type: 'password', placeholder: 'pdl_ntfset_...', group: 'paddle', tab: 'payment' },
    {
      name: 'paddle_environment', title: 'Environment', type: 'select',
      options: [
        { label: 'Sandbox', value: 'sandbox' },
        { label: 'Production', value: 'production' },
      ],
      group: 'paddle', tab: 'payment', defaultValue: 'sandbox',
    },

    // ─── Payment / PayPal ────────────────────────────────────────────
    { name: 'paypal_enabled', title: 'Enable PayPal', type: 'switch', group: 'paypal', tab: 'payment' },
    { name: 'paypal_client_id', title: 'Client ID', type: 'text', placeholder: 'xxx', group: 'paypal', tab: 'payment' },
    { name: 'paypal_client_secret', title: 'Client Secret', type: 'password', placeholder: 'xxx', group: 'paypal', tab: 'payment' },
    { name: 'paypal_webhook_id', title: 'Webhook ID', type: 'text', placeholder: 'xxx', group: 'paypal', tab: 'payment' },
    {
      name: 'paypal_environment', title: 'Environment', type: 'select',
      options: [
        { label: 'Sandbox', value: 'sandbox' },
        { label: 'Live', value: 'live' },
      ],
      group: 'paypal', tab: 'payment',
    },
    { name: 'paypal_test_amount', title: 'Test amount (cents)', type: 'number', placeholder: 'Leave empty to use the real amount; enter 1 to pay $0.01', group: 'paypal', tab: 'payment' },

    // ─── Payment / Alipay ─────────────────────────────────────────────
    { name: 'alipay_enabled', title: 'Enable Alipay', type: 'switch', group: 'alipay', tab: 'payment' },
    { name: 'alipay_app_id', title: 'App ID', type: 'text', placeholder: '2021xxx', group: 'alipay', tab: 'payment' },
    { name: 'alipay_private_key', title: 'Private Key (RSA2)', type: 'textarea', placeholder: 'MIIEvQIBADANBgkq...', group: 'alipay', tab: 'payment' },
    { name: 'alipay_public_key', title: 'Alipay Public Key', type: 'textarea', placeholder: 'MIIBIjANBgkq...', group: 'alipay', tab: 'payment' },
    { name: 'alipay_notify_url', title: 'Notify URL (Webhook)', type: 'text', placeholder: 'https://example.com/api/payment/notify/alipay', group: 'alipay', tab: 'payment' },
    { name: 'alipay_test_amount', title: 'Test amount (fen)', type: 'number', placeholder: 'Leave empty to use the real amount; enter 1 to pay ¥0.01', group: 'alipay', tab: 'payment' },

    // ─── Payment / WeChat Pay ───────────────────────────────────────
    { name: 'wechat_enabled', title: 'Enable WeChat Pay', type: 'switch', group: 'wechat', tab: 'payment' },
    { name: 'wechat_app_id', title: 'AppID', type: 'text', placeholder: 'wx1234567890', group: 'wechat', tab: 'payment' },
    { name: 'wechat_mch_id', title: 'Merchant ID', type: 'text', placeholder: '1900000001', group: 'wechat', tab: 'payment' },
    { name: 'wechat_api_v3_key', title: 'APIv3 Key (32 characters)', type: 'password', placeholder: '32 chars', group: 'wechat', tab: 'payment' },
    { name: 'wechat_private_key', title: 'Merchant Private Key (PEM)', type: 'textarea', placeholder: 'MIIEvgIBADANBgkq...', group: 'wechat', tab: 'payment' },
    { name: 'wechat_serial_no', title: 'Certificate Serial No', type: 'text', placeholder: 'xxx', group: 'wechat', tab: 'payment' },
    { name: 'wechat_notify_url', title: 'Notify URL (Webhook)', type: 'text', placeholder: 'https://example.com/api/payment/notify/wechat', group: 'wechat', tab: 'payment' },
    { name: 'wechat_test_amount', title: 'Test amount (fen)', type: 'number', placeholder: 'Leave empty to use the real amount; enter 1 to pay ¥0.01', group: 'wechat', tab: 'payment' },

    // ─── Email / Basic ───────────────────────────────────────────────
    {
      name: 'default_email_provider', title: 'Default provider', type: 'select',
      options: [
        { label: 'Resend', value: 'resend' },
        { label: 'Mailgun', value: 'mailgun' },
      ],
      group: 'basic_email', tab: 'email', defaultValue: 'resend',
    },

    // ─── Email / Resend ──────────────────────────────────────────────
    { name: 'resend_api_key', title: 'API Key', type: 'password', placeholder: 're_xxx', group: 'resend', tab: 'email' },
    { name: 'resend_sender_email', title: 'Sender Email', type: 'text', placeholder: 'hello@example.com', group: 'resend', tab: 'email' },

    // ─── Email / Mailgun ─────────────────────────────────────────────
    { name: 'mailgun_api_key', title: 'API Key', type: 'password', placeholder: 'key-xxx', group: 'mailgun', tab: 'email' },
    { name: 'mailgun_domain', title: 'Sending Domain', type: 'text', placeholder: 'mg.example.com', group: 'mailgun', tab: 'email' },
    { name: 'mailgun_sender_email', title: 'Sender Email', type: 'text', placeholder: 'hello@mg.example.com', group: 'mailgun', tab: 'email' },
    {
      name: 'mailgun_region', title: 'Region', type: 'select',
      options: [
        { label: 'United States', value: 'us' },
        { label: 'European Union', value: 'eu' },
      ],
      group: 'mailgun', tab: 'email', defaultValue: 'us',
    },

    // ─── Storage / R2 ────────────────────────────────────────────────
    // Keys mirror the legacy storage config (`r2_*`) so existing DB config is read as-is.
    { name: 'r2_access_key', title: 'Cloudflare Access Key', type: 'text', placeholder: '', group: 'r2', tab: 'storage' },
    { name: 'r2_secret_key', title: 'Cloudflare Secret Key', type: 'password', placeholder: '', group: 'r2', tab: 'storage' },
    { name: 'r2_bucket_name', title: 'Bucket Name', type: 'text', placeholder: '', group: 'r2', tab: 'storage' },
    { name: 'r2_upload_path', title: 'Upload Path', type: 'text', placeholder: 'uploads', tip: 'Path to upload files to; leave empty to use the default. Example: uploads/foo/bar', group: 'r2', tab: 'storage' },
    { name: 'r2_endpoint', title: 'Endpoint', type: 'text', placeholder: 'https://<account-id>.r2.cloudflarestorage.com', tip: 'Leave empty to use the default R2 endpoint', group: 'r2', tab: 'storage' },
    { name: 'r2_domain', title: 'Domain', type: 'text', placeholder: 'https://cdn.example.com', group: 'r2', tab: 'storage' },

    // ─── AI / BeatAPI ────────────────────────────────────────────────
    { name: 'BEATAPI_API_BASE_URL', title: 'API Base URL', type: 'text', placeholder: 'https://api.beatapi.io', group: 'beatapi', tab: 'ai', defaultValue: 'https://api.beatapi.io' },
    { name: 'BEATAPI_API_KEY', title: 'API Key', type: 'password', placeholder: 'Your server-side BeatAPI key', group: 'beatapi', tab: 'ai', tip: 'Used only on the server for image and video generation.' },

    // ─── Analytics / Google Analytics ────────────────────────────────
    { name: 'google_analytics_id', title: 'Measurement ID', type: 'text', placeholder: 'G-XXXXXXXXXX', group: 'google_analytics', tab: 'analytics' },

    // ─── Analytics / Plausible ───────────────────────────────────────
    { name: 'plausible_domain', title: 'Domain', type: 'text', placeholder: 'example.com', tip: 'The domain registered in your Plausible dashboard', group: 'plausible', tab: 'analytics' },
    { name: 'plausible_src', title: 'Script Src', type: 'text', placeholder: 'https://plausible.io/js/script.js', tip: 'Use https://plausible.io/js/script.js for cloud, or your self-hosted URL', group: 'plausible', tab: 'analytics' },
  ];
}
