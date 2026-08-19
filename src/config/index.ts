export const AUTH_SECRET_PLACEHOLDER = 'beat-ai-dev-secret-change-in-production';

// Isomorphic env access:
// - Public (client-visible) vars are VITE_-prefixed and read from
//   import.meta.env (statically injected into the client bundle by Vite).
// - Server-only vars (secrets) are read from process.env and resolve to ''
//   in the browser — they never reach the client bundle.
const metaEnv: Record<string, string | undefined> =
  (import.meta as any).env ?? {};
const procEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

const publicEnv = (key: string) => metaEnv[key] ?? procEnv[key];

export const envConfigs: Record<string, string> = {
  // App (public)
  app_url: publicEnv('VITE_APP_URL') ?? 'http://localhost:3020',
  app_name: publicEnv('VITE_APP_NAME') ?? 'BeatAPI',
  app_description:
    publicEnv('VITE_APP_DESCRIPTION') ??
    'Open SaaS starter for AI products',
  app_logo: publicEnv('VITE_APP_LOGO') ?? '/logo.png',
  github_repo_url: publicEnv('VITE_GITHUB_REPO_URL') ?? '',
  workspace_mode: publicEnv('VITE_WORKSPACE_MODE') ?? 'canvas',

  // Database
  database_url: procEnv.DATABASE_URL ?? '',
  database_auth_token: procEnv.DATABASE_AUTH_TOKEN ?? '',
  database_provider: procEnv.DATABASE_PROVIDER ?? 'postgres',
  db_schema: procEnv.DB_SCHEMA ?? 'public',
  db_singleton_enabled: procEnv.DB_SINGLETON_ENABLED ?? 'false',
  db_max_connections: procEnv.DB_MAX_CONNECTIONS ?? '1',

  // Auth
  auth_url: procEnv.AUTH_URL ?? publicEnv('VITE_APP_URL') ?? '',
  auth_secret: procEnv.AUTH_SECRET ?? '',
  email_auth_enabled: publicEnv('VITE_EMAIL_AUTH_ENABLED') ?? 'true',
  email_verification_enabled:
    publicEnv('VITE_EMAIL_VERIFICATION_ENABLED') ?? 'true',
  google_auth_enabled: publicEnv('VITE_GOOGLE_AUTH_ENABLED') ?? '',
  google_one_tap_enabled: publicEnv('VITE_GOOGLE_ONE_TAP_ENABLED') ?? '',
  google_client_id:
    publicEnv('VITE_GOOGLE_CLIENT_ID') ?? procEnv.GOOGLE_CLIENT_ID ?? '',
  google_client_secret: procEnv.GOOGLE_CLIENT_SECRET ?? '',
  invite_code_required: publicEnv('VITE_INVITE_CODE_REQUIRED') ?? 'false',
  initial_credits_enabled: procEnv.INITIAL_CREDITS_ENABLED ?? 'true',
  initial_credits_amount: procEnv.INITIAL_CREDITS_AMOUNT ?? '100',
  initial_credits_valid_days: procEnv.INITIAL_CREDITS_VALID_DAYS ?? '365',
  initial_credits_description:
    procEnv.INITIAL_CREDITS_DESCRIPTION ?? 'Welcome credits',

  // Public widgets / anti-abuse
  crisp_enabled: publicEnv('VITE_CRISP_ENABLED') ?? 'false',
  turnstile_enabled: publicEnv('VITE_TURNSTILE_ENABLED') ?? 'false',
  turnstile_site_key: publicEnv('VITE_TURNSTILE_SITE_KEY') ?? '',
  turnstile_secret_key: procEnv.TURNSTILE_SECRET_KEY ?? '',

  // Analytics
  google_analytics_id: publicEnv('VITE_GOOGLE_ANALYTICS_ID') ?? '',

  // Payment - PayPal
  generic_payment_enabled: procEnv.GENERIC_PAYMENT_ENABLED ?? '',
  select_payment_enabled: publicEnv('VITE_SELECT_PAYMENT_ENABLED') ?? 'true',
  default_payment_provider: procEnv.DEFAULT_PAYMENT_PROVIDER ?? 'stripe',
  payment_catalog_json: procEnv.PAYMENT_CATALOG_JSON ?? '',

  // Payment - Stripe
  stripe_enabled: procEnv.STRIPE_ENABLED ?? '',
  stripe_publishable_key: procEnv.STRIPE_PUBLISHABLE_KEY ?? '',
  stripe_secret_key: procEnv.STRIPE_SECRET_KEY ?? procEnv.STRIPE_API_KEY ?? '',
  stripe_signing_secret:
    procEnv.STRIPE_SIGNING_SECRET ?? procEnv.STRIPE_WEBHOOK_SECRET ?? '',

  // Payment - Creem
  creem_enabled: procEnv.CREEM_ENABLED ?? '',
  creem_api_key: procEnv.CREEM_API_KEY ?? '',
  creem_signing_secret: procEnv.CREEM_SIGNING_SECRET ?? '',
  creem_environment: procEnv.CREEM_ENVIRONMENT ?? 'sandbox',

  // Payment - Lemon Squeezy
  lemonsqueezy_enabled: procEnv.LEMONSQUEEZY_ENABLED ?? '',
  lemonsqueezy_api_key: procEnv.LEMONSQUEEZY_API_KEY ?? '',
  lemonsqueezy_store_id: procEnv.LEMONSQUEEZY_STORE_ID ?? '',
  lemonsqueezy_signing_secret: procEnv.LEMONSQUEEZY_SIGNING_SECRET ?? '',
  lemonsqueezy_test_mode: procEnv.LEMONSQUEEZY_TEST_MODE ?? 'true',

  // Payment - Paddle
  paddle_enabled: procEnv.PADDLE_ENABLED ?? '',
  paddle_api_key: procEnv.PADDLE_API_KEY ?? '',
  paddle_webhook_secret: procEnv.PADDLE_WEBHOOK_SECRET ?? '',
  paddle_environment: procEnv.PADDLE_ENVIRONMENT ?? 'sandbox',

  // Payment - PayPal
  paypal_enabled: procEnv.PAYPAL_ENABLED ?? '',
  paypal_client_id: procEnv.PAYPAL_CLIENT_ID ?? '',
  paypal_client_secret: procEnv.PAYPAL_CLIENT_SECRET ?? '',
  paypal_webhook_id: procEnv.PAYPAL_WEBHOOK_ID ?? '',
  paypal_environment: procEnv.PAYPAL_ENVIRONMENT ?? 'production',

  // Payment - Alipay
  alipay_enabled: procEnv.ALIPAY_ENABLED ?? '',
  alipay_app_id: procEnv.ALIPAY_APP_ID ?? '',
  alipay_private_key: procEnv.ALIPAY_PRIVATE_KEY ?? '',
  alipay_public_key: procEnv.ALIPAY_PUBLIC_KEY ?? '',
  alipay_notify_url: procEnv.ALIPAY_NOTIFY_URL ?? '',

  // Payment - WeChat Pay
  wechat_enabled: procEnv.WECHAT_ENABLED ?? '',
  wechat_app_id: procEnv.WECHAT_APP_ID ?? '',
  wechat_mch_id: procEnv.WECHAT_MCH_ID ?? '',
  wechat_api_v3_key: procEnv.WECHAT_API_V3_KEY ?? '',
  wechat_private_key: procEnv.WECHAT_PRIVATE_KEY ?? '',
  wechat_serial_no: procEnv.WECHAT_SERIAL_NO ?? '',
  wechat_notify_url: procEnv.WECHAT_NOTIFY_URL ?? '',
  wechat_platform_cert: procEnv.WECHAT_PLATFORM_CERT ?? '',

  // Email - Resend
  default_email_provider: procEnv.DEFAULT_EMAIL_PROVIDER ?? 'resend',
  resend_api_key: procEnv.RESEND_API_KEY ?? '',
  resend_sender_email: procEnv.RESEND_SENDER_EMAIL ?? procEnv.RESEND_EMAIL_FROM ?? '',
  mailgun_api_key: procEnv.MAILGUN_API_KEY ?? '',
  mailgun_domain: procEnv.MAILGUN_DOMAIN ?? '',
  mailgun_sender_email: procEnv.MAILGUN_SENDER_EMAIL ?? '',
  mailgun_region: procEnv.MAILGUN_REGION ?? 'us',

  // Local-preview inline uploads remain size-capped; hosted assets use R2.
  inline_image_max_kb: procEnv.INLINE_IMAGE_MAX_KB ?? '2048',

  // Workspace storage - Cloudflare R2
  r2_region: procEnv.R2_REGION ?? 'auto',
  r2_endpoint: procEnv.R2_ENDPOINT ?? '',
  r2_access_key_id: procEnv.R2_ACCESS_KEY_ID ?? '',
  r2_secret_access_key: procEnv.R2_SECRET_ACCESS_KEY ?? '',
  r2_image_bucket_name: procEnv.R2_IMAGE_BUCKET_NAME ?? '',
  r2_image_public_url: procEnv.R2_IMAGE_PUBLIC_URL ?? '',
  r2_video_bucket_name: procEnv.R2_VIDEO_BUCKET_NAME ?? '',
  r2_video_public_url: procEnv.R2_VIDEO_PUBLIC_URL ?? '',
  r2_force_path_style: procEnv.R2_FORCE_PATH_STYLE ?? 'true',

  // Generation — BeatAPI is the only built-in upstream.
  beatapi_api_base_url:
    procEnv.BEATAPI_API_BASE_URL ?? 'https://api.beatapi.io',
  beatapi_api_key: procEnv.BEATAPI_API_KEY ?? '',

  // Locale (public)
  locale: publicEnv('VITE_DEFAULT_LOCALE') ?? 'en',
};
