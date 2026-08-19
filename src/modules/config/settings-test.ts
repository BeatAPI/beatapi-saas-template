/**
 * Server-side runner for settings tests.
 *
 * Safe side effects only: no orders are persisted, no webhooks fire —
 * just raw provider SDK calls to prove credentials work.
 *
 * Spec data lives in ./settings-test-specs so the client bundle can
 * import it without pulling provider SDKs.
 */

import {
  CreemProvider,
  LemonSqueezyProvider,
  PaddleProvider,
  PayPalProvider,
  AlipayProvider,
  WechatPayProvider,
} from '@/core/payment';
import type { PaymentOrder } from '@/core/payment/types';
import { PaymentType } from '@/core/payment/types';
import { ResendProvider } from '@/core/email/resend';
import { MailgunProvider } from '@/core/email/mailgun';
import { R2Provider } from '@/core/storage/r2';
import { ReplicateProvider } from '@/core/ai/replicate';
import { GeminiProvider } from '@/core/ai/gemini';
import { FalProvider } from '@/core/ai/fal';
import { AIMediaType } from '@/core/ai/types';
import { getUniSeq } from '@/lib/hash';
import { envConfigs } from '@/config';
import type { TestResult } from './settings-test-specs';

export { getTestSpec, getTestableGroups } from './settings-test-specs';
export type { TestField, TestSpec, TestResult } from './settings-test-specs';

export async function runTest(
  group: string,
  inputs: Record<string, string>,
  configs: Record<string, string>,
): Promise<TestResult> {
  try {
    switch (group) {
      case 'resend':
        return await testResend(inputs, configs);
      case 'mailgun':
        return await testMailgun(inputs, configs);
      case 'creem':
        return await testCreem(inputs, configs);
      case 'lemonsqueezy':
        return await testLemonSqueezy(inputs, configs);
      case 'paddle':
        return await testPaddle(inputs, configs);
      case 'paypal':
        return await testPaypal(inputs, configs);
      case 'alipay':
        return await testAlipay(inputs, configs);
      case 'wechat':
        return await testWechat(inputs, configs);
      case 'r2':
        return await testR2(inputs, configs);
      case 'replicate':
        return await testReplicate(inputs, configs);
      case 'gemini':
        return await testGemini(inputs, configs);
      case 'fal':
        return await testFal(inputs, configs);
      default:
        return { success: false, message: `No test available for "${group}"` };
    }
  } catch (error: any) {
    return { success: false, message: error?.message || 'Test failed with unknown error' };
  }
}

function need(configs: Record<string, string>, keys: string[]): string | null {
  const missing = keys.filter((k) => !configs[k]);
  return missing.length ? `Missing config: ${missing.join(', ')}` : null;
}

function successUrl(group: string) {
  return `${envConfigs.app_url}/admin/settings?test=${group}`;
}

// --- Resend ---------------------------------------------------------------

async function testResend(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['resend_api_key', 'resend_sender_email']);
  if (missing) return { success: false, message: missing };

  const provider = new ResendProvider({
    apiKey: configs.resend_api_key,
    defaultFrom: configs.resend_sender_email,
  });

  const result = await provider.sendEmail({
    to: inputs.to,
    subject: `[${envConfigs.app_name}] Test email`,
    text: `This is a test email from ${envConfigs.app_name} admin settings. If you received it, Resend is configured correctly.`,
  });

  if (!result.success) {
    return { success: false, message: result.error || 'Send failed' };
  }

  return {
    success: true,
    message: 'Email sent successfully',
    details: result.messageId ? { 'Message ID': result.messageId } : undefined,
  };
}

async function testMailgun(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, [
    'mailgun_api_key',
    'mailgun_domain',
    'mailgun_sender_email',
  ]);
  if (missing) return { success: false, message: missing };

  const provider = new MailgunProvider({
    apiKey: configs.mailgun_api_key,
    domain: configs.mailgun_domain,
    defaultFrom: configs.mailgun_sender_email,
    region: configs.mailgun_region === 'eu' ? 'eu' : 'us',
  });
  const result = await provider.sendEmail({
    to: inputs.to,
    subject: `[${envConfigs.app_name}] Mailgun test email`,
    text: `This is a test email from ${envConfigs.app_name}.`,
  });
  return result.success
    ? {
        success: true,
        message: 'Email sent successfully',
        details: result.messageId ? { 'Message ID': result.messageId } : undefined,
      }
    : { success: false, message: result.error || 'Send failed' };
}

// --- Creem ----------------------------------------------------------------

async function testCreem(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['creem_api_key']);
  if (missing) return { success: false, message: missing };

  const provider = new CreemProvider({
    apiKey: configs.creem_api_key,
    signingSecret: configs.creem_signing_secret || undefined,
    environment: configs.creem_environment === 'production' ? 'production' : 'sandbox',
  });

  const order: PaymentOrder = {
    type: PaymentType.ONE_TIME,
    orderNo: getUniSeq('TEST'),
    productId: inputs.productId,
    description: inputs.description || 'Test checkout',
    successUrl: successUrl('creem'),
    cancelUrl: successUrl('creem'),
  };

  const session = await provider.createPayment({ order });
  return {
    success: true,
    message: 'Checkout session created',
    details: {
      'Session ID': session.checkoutInfo.sessionId,
      'Checkout URL': session.checkoutInfo.checkoutUrl,
    },
  };
}

async function testLemonSqueezy(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, [
    'lemonsqueezy_api_key',
    'lemonsqueezy_store_id',
    'lemonsqueezy_signing_secret',
  ]);
  if (missing) return { success: false, message: missing };
  const provider = new LemonSqueezyProvider({
    apiKey: configs.lemonsqueezy_api_key,
    storeId: configs.lemonsqueezy_store_id,
    signingSecret: configs.lemonsqueezy_signing_secret,
    testMode: configs.lemonsqueezy_test_mode !== 'false',
  });
  const session = await provider.createPayment({
    order: {
      productId: inputs.variantId,
      description: 'Lemon Squeezy test checkout',
      successUrl: successUrl('lemonsqueezy'),
      metadata: { localOrderNo: getUniSeq('TEST') },
    },
  });
  return {
    success: true,
    message: 'Checkout session created',
    details: {
      'Checkout ID': session.checkoutInfo.sessionId,
      'Checkout URL': session.checkoutInfo.checkoutUrl,
    },
  };
}

async function testPaddle(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['paddle_api_key', 'paddle_webhook_secret']);
  if (missing) return { success: false, message: missing };
  const provider = new PaddleProvider({
    apiKey: configs.paddle_api_key,
    webhookSecret: configs.paddle_webhook_secret,
    environment: configs.paddle_environment === 'production' ? 'production' : 'sandbox',
  });
  const session = await provider.createPayment({
    order: {
      productId: inputs.priceId,
      description: 'Paddle test checkout',
      metadata: { localOrderNo: getUniSeq('TEST') },
    },
  });
  return {
    success: true,
    message: 'Checkout session created',
    details: {
      'Transaction ID': session.checkoutInfo.sessionId,
      'Checkout URL': session.checkoutInfo.checkoutUrl,
    },
  };
}

// --- PayPal ---------------------------------------------------------------

async function testPaypal(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['paypal_client_id', 'paypal_client_secret']);
  if (missing) return { success: false, message: missing };

  const provider = new PayPalProvider({
    clientId: configs.paypal_client_id,
    clientSecret: configs.paypal_client_secret,
    environment: configs.paypal_environment === 'live' ? 'production' : 'sandbox',
    webhookId: configs.paypal_webhook_id || undefined,
  });

  const order: PaymentOrder = {
    type: PaymentType.ONE_TIME,
    orderNo: getUniSeq('TEST'),
    price: { amount: Number(inputs.amount) || 100, currency: (inputs.currency || 'USD').toUpperCase() },
    description: inputs.description || 'Test checkout',
    successUrl: successUrl('paypal'),
    cancelUrl: successUrl('paypal'),
  };

  const session = await provider.createPayment({ order });
  return {
    success: true,
    message: 'Checkout session created',
    details: {
      'Order ID': session.checkoutInfo.sessionId,
      'Approval URL': session.checkoutInfo.checkoutUrl,
    },
  };
}

// --- Alipay ---------------------------------------------------------------

async function testAlipay(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['alipay_app_id', 'alipay_private_key', 'alipay_public_key']);
  if (missing) return { success: false, message: missing };

  const provider = new AlipayProvider({
    appId: configs.alipay_app_id,
    privateKey: configs.alipay_private_key,
    alipayPublicKey: configs.alipay_public_key,
    notifyUrl: configs.alipay_notify_url || undefined,
  });

  const order: PaymentOrder = {
    type: PaymentType.ONE_TIME,
    orderNo: getUniSeq('TEST'),
    price: { amount: Number(inputs.amount) || 1, currency: 'CNY' },
    description: inputs.description || 'Test checkout',
    successUrl: successUrl('alipay'),
  };

  const session = await provider.createPayment({ order });
  return {
    success: true,
    message: 'Checkout created',
    details: {
      'Order No': session.checkoutInfo.sessionId,
      'Checkout URL': session.checkoutInfo.checkoutUrl,
    },
  };
}

// --- WeChat Pay -----------------------------------------------------------

async function testWechat(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['wechat_app_id', 'wechat_mch_id', 'wechat_private_key', 'wechat_api_v3_key', 'wechat_serial_no']);
  if (missing) return { success: false, message: missing };

  const provider = new WechatPayProvider({
    appId: configs.wechat_app_id,
    mchId: configs.wechat_mch_id,
    apiV3Key: configs.wechat_api_v3_key,
    privateKey: configs.wechat_private_key,
    serialNo: configs.wechat_serial_no,
    notifyUrl: configs.wechat_notify_url || undefined,
  });

  const order: PaymentOrder = {
    type: PaymentType.ONE_TIME,
    orderNo: getUniSeq('TEST'),
    price: { amount: Number(inputs.amount) || 1, currency: 'CNY' },
    description: inputs.description || 'Test checkout',
  };

  const session = await provider.createPayment({ order });
  return {
    success: true,
    message: 'Checkout created',
    details: {
      'Order No': session.checkoutInfo.sessionId,
      'Checkout URL': session.checkoutInfo.checkoutUrl,
    },
  };
}

// --- Storage --------------------------------------------------------------

async function testR2(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['r2_access_key', 'r2_secret_key', 'r2_bucket_name']);
  if (missing) return { success: false, message: missing };

  const provider = new R2Provider({
    accountId: configs.r2_account_id || '',
    accessKeyId: configs.r2_access_key,
    secretAccessKey: configs.r2_secret_key,
    bucket: configs.r2_bucket_name,
    uploadPath: configs.r2_upload_path,
    region: 'auto',
    endpoint: configs.r2_endpoint || undefined,
    publicDomain: configs.r2_domain || undefined,
  });

  const safeName = (inputs.filename || 'beatapi-settings-test.txt').replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `settings-test/${Date.now()}-${safeName}`;
  const body = Buffer.from(
    `BeatAPI settings test\nTimestamp: ${new Date().toISOString()}\n`,
    'utf-8',
  );

  const result = await provider.uploadFile({
    body,
    key,
    contentType: 'text/plain',
  });

  if (!result.success) {
    return { success: false, message: result.error || 'Upload failed' };
  }

  const details: Record<string, string> = { Key: key };
  if (result.url) details['URL'] = result.url;
  if (result.location) details['Location'] = result.location;
  return { success: true, message: 'Uploaded test object', details };
}

// --- AI -------------------------------------------------------------------

async function testReplicate(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['replicate_api_token']);
  if (missing) return { success: false, message: missing };

  const provider = new ReplicateProvider({ apiToken: configs.replicate_api_token });
  const result = await provider.generate({
    params: {
      mediaType: AIMediaType.IMAGE,
      model: inputs.model,
      prompt: inputs.prompt,
    },
  });
  return {
    success: true,
    message: 'Replicate accepted the request',
    details: { 'Task ID': result.taskId, Status: result.taskStatus },
  };
}

async function testGemini(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['gemini_api_key']);
  if (missing) return { success: false, message: missing };

  const provider = new GeminiProvider({ apiKey: configs.gemini_api_key });
  const result = await provider.generate({
    params: {
      mediaType: AIMediaType.IMAGE,
      model: inputs.model,
      prompt: inputs.prompt,
    },
  });
  return {
    success: true,
    message: 'Gemini accepted the request',
    details: { 'Task ID': result.taskId, Status: result.taskStatus },
  };
}

async function testFal(inputs: Record<string, string>, configs: Record<string, string>): Promise<TestResult> {
  const missing = need(configs, ['fal_api_key']);
  if (missing) return { success: false, message: missing };

  const provider = new FalProvider({ apiKey: configs.fal_api_key });
  const result = await provider.generate({
    params: {
      mediaType: AIMediaType.IMAGE,
      model: inputs.model,
      prompt: inputs.prompt,
    },
  });
  return {
    success: true,
    message: 'Fal accepted the request',
    details: { 'Task ID': result.taskId, Status: result.taskStatus },
  };
}
