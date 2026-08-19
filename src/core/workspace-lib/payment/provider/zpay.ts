import { createHash, randomInt, randomUUID } from 'crypto';
import { addCredits } from '@/core/workspace-credits/credits';
import { getCreditPackageById } from '@/core/workspace-credits/server';
import { CREDIT_TRANSACTION_TYPE } from '@/core/workspace-credits/types';
import { settleVerifiedZpayPayment } from '../zpay-settlement';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { creditTransaction, payment } from '@/config/db/schema';
import { getConfiguredBaseUrl } from '@/core/workspace-lib/urls/urls';
import { and, eq } from 'drizzle-orm';
import type { Locale } from '@/core/workspace-lib/shims/next-intl';
import { type CheckoutResult, PaymentScenes, PaymentTypes } from '../types';

export type ZpayPaymentMethod = 'alipay' | 'wxpay';

type ZpayPrimitive = string | number | boolean | null | undefined;
type ZpayParams = Record<string, ZpayPrimitive>;

type ZpayRuntimeConfig = {
  pid: string;
  key: string;
  gatewayUrl: string;
};

type ZpayCheckoutParams = {
  pid: string;
  type: ZpayPaymentMethod;
  out_trade_no: string;
  notify_url: string;
  name: string;
  money: string;
  return_url: string;
  param?: string;
  sitename?: string;
};

type CreateZpayCreditCheckoutParams = {
  packageId: string;
  paymentMethod: ZpayPaymentMethod;
  userId: string;
  locale?: Locale;
};

const DEFAULT_ZPAY_GATEWAY_URL = 'https://zpayz.cn';
const ZPAY_CREDIT_PRICE_ID_PREFIX = 'zpay:credits:';

function normalizeZpayGatewayUrl(gatewayUrl: string): string {
  return gatewayUrl.replace(/\/+$/, '');
}

function normalizeZpayAmount(value: string | number): string {
  const amount = Number.parseFloat(String(value));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid ZPAY amount: ${value}`);
  }

  return amount.toFixed(2);
}

function getZpayCreditPriceId(
  packageId: string,
  paymentMethod: ZpayPaymentMethod
): string {
  return `${ZPAY_CREDIT_PRICE_ID_PREFIX}${packageId}:${paymentMethod}`;
}

function parseZpayCreditPriceId(priceId: string):
  | {
      packageId: string;
      paymentMethod: ZpayPaymentMethod;
    }
  | undefined {
  if (!priceId.startsWith(ZPAY_CREDIT_PRICE_ID_PREFIX)) {
    return undefined;
  }

  const [packageId, paymentMethod] = priceId
    .slice(ZPAY_CREDIT_PRICE_ID_PREFIX.length)
    .split(':');

  if (!packageId || (paymentMethod !== 'alipay' && paymentMethod !== 'wxpay')) {
    return undefined;
  }

  return { packageId, paymentMethod };
}

function getZpayCreditPriceEnvKey(packageId: string): string {
  const normalizedPackageId = packageId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalizedPackageId) {
    throw new Error('Invalid ZPAY credit package id');
  }

  return `ZPAY_PRICE_CNY_CREDITS_${normalizedPackageId}`;
}

function getZpayCreditPackageAmountCny(packageId: string): string {
  const envKey = getZpayCreditPriceEnvKey(packageId);
  const rawAmount = process.env[envKey];
  if (!rawAmount) {
    throw new Error(`Missing ${envKey} amount`);
  }

  return normalizeZpayAmount(rawAmount);
}

function getZpayRuntimeConfig(): ZpayRuntimeConfig {
  const pid = process.env.ZPAY_PID;
  const key = process.env.ZPAY_KEY;

  if (!pid) {
    throw new Error('ZPAY_PID environment variable is not set');
  }
  if (!key) {
    throw new Error('ZPAY_KEY environment variable is not set');
  }

  return {
    pid,
    key,
    gatewayUrl: normalizeZpayGatewayUrl(
      process.env.ZPAY_GATEWAY_URL ?? DEFAULT_ZPAY_GATEWAY_URL
    ),
  };
}

function normalizeZpayParams(
  input: URLSearchParams | Record<string, unknown>
): Record<string, string> {
  const params: Record<string, string> = {};

  if (input instanceof URLSearchParams) {
    input.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  Object.entries(input).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const firstValue = value[0];
      if (firstValue !== undefined && firstValue !== null) {
        params[key] = String(firstValue);
      }
      return;
    }

    if (value !== undefined && value !== null) {
      params[key] = String(value);
    }
  });

  return params;
}

function getZpaySignPayload(params: ZpayParams): string {
  return Object.entries(params)
    .filter(([key, value]) => {
      if (key === 'sign' || key === 'sign_type') {
        return false;
      }
      return value !== undefined && value !== null && String(value) !== '';
    })
    .sort(([left], [right]) => {
      if (left < right) {
        return -1;
      }
      if (left > right) {
        return 1;
      }
      return 0;
    })
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}

export function buildZpaySign(params: ZpayParams, key: string): string {
  return createHash('md5')
    .update(`${getZpaySignPayload(params)}${key}`)
    .digest('hex');
}

export function verifyZpaySign(
  params: URLSearchParams | Record<string, unknown>,
  key: string
): boolean {
  const normalizedParams = normalizeZpayParams(params);
  const providedSign = normalizedParams.sign;
  if (!providedSign) {
    return false;
  }

  return buildZpaySign(normalizedParams, key) === providedSign.toLowerCase();
}

export function buildZpayCheckoutUrl(
  params: ZpayCheckoutParams,
  config: Pick<ZpayRuntimeConfig, 'key' | 'gatewayUrl'>
): string {
  const signedParams = {
    ...params,
    sign: buildZpaySign(params, config.key),
    sign_type: 'MD5',
  };
  const url = new URL(
    '/submit.php',
    normalizeZpayGatewayUrl(config.gatewayUrl)
  );

  Object.entries(signedParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function createZpayOutTradeNo(): string {
  return `${Date.now()}${randomInt(100_000, 999_999)}`;
}

function getZpayParam({
  packageId,
  locale,
}: {
  packageId: string;
  locale?: Locale;
}): string {
  return [`package:${packageId}`, locale ? `locale:${locale}` : null]
    .filter(Boolean)
    .join('|');
}

export function getZpayLocaleFromParam(param?: string | null): Locale | null {
  const locale = param?.match(/(?:^|\|)locale:([a-zA-Z-]+)/)?.[1];
  return locale ? (locale as Locale) : null;
}

function getZpayProductName(packageId: string, credits: number): string {
  return `BeatAPI ${credits} Credits Package (${packageId})`;
}

async function queryZpayOrder(
  outTradeNo: string,
  config: ZpayRuntimeConfig
): Promise<Record<string, unknown>> {
  const url = new URL('/api.php', config.gatewayUrl);
  url.searchParams.set('act', 'order');
  url.searchParams.set('pid', config.pid);
  url.searchParams.set('key', config.key);
  url.searchParams.set('out_trade_no', outTradeNo);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ZPAY order query failed with ${response.status}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function createZpayCreditCheckout({
  packageId,
  paymentMethod,
  userId,
  locale,
}: CreateZpayCreditCheckoutParams): Promise<CheckoutResult> {
  const creditPackage = getCreditPackageById(packageId);
  if (!creditPackage || creditPackage.disabled) {
    throw new Error(`Credit package with ID ${packageId} not found`);
  }

  const config = getZpayRuntimeConfig();
  const amountCny = getZpayCreditPackageAmountCny(packageId);
  const outTradeNo = createZpayOutTradeNo();
  const baseUrl = getConfiguredBaseUrl();
  const currentDate = new Date();
  const db = await getDb();

  await db.insert(payment).values({
    id: randomUUID(),
    priceId: getZpayCreditPriceId(packageId, paymentMethod),
    type: PaymentTypes.ONE_TIME,
    scene: PaymentScenes.CREDIT,
    userId,
    customerId: `zpay:${userId}`,
    sessionId: outTradeNo,
    invoiceId: null,
    paid: false,
    status: 'processing',
    createdAt: currentDate,
    updatedAt: currentDate,
  });

  return {
    id: outTradeNo,
    url: buildZpayCheckoutUrl(
      {
        pid: config.pid,
        type: paymentMethod,
        out_trade_no: outTradeNo,
        notify_url: `${baseUrl}/api/webhooks/zpay`,
        return_url: `${baseUrl}/api/payment/zpay/return`,
        name: getZpayProductName(packageId, creditPackage.amount),
        money: amountCny,
        param: getZpayParam({ packageId, locale }),
        sitename: 'BeatAPI',
      },
      config
    ),
  };
}

export async function handleZpayNotification(
  input: URLSearchParams | Record<string, unknown>
): Promise<{ outTradeNo: string; processed: boolean }> {
  const params = normalizeZpayParams(input);
  const config = getZpayRuntimeConfig();

  if (!verifyZpaySign(params, config.key)) {
    throw new Error('Invalid ZPAY signature');
  }
  if (params.pid !== config.pid) {
    throw new Error('Invalid ZPAY pid');
  }

  const outTradeNo = params.out_trade_no;
  if (!outTradeNo) {
    throw new Error('Missing ZPAY out_trade_no');
  }
  if (params.trade_status !== 'TRADE_SUCCESS') {
    return { outTradeNo, processed: false };
  }

  const db = await getDb();
  const paymentRows = await db
    .select()
    .from(payment)
    .where(eq(payment.sessionId, outTradeNo))
    .limit(1);
  const paymentRecord = paymentRows[0];
  if (!paymentRecord) {
    throw new Error(`Payment record not found for ZPAY order ${outTradeNo}`);
  }

  const zpayPrice = parseZpayCreditPriceId(paymentRecord.priceId);
  if (!zpayPrice) {
    throw new Error(`Invalid ZPAY price ID ${paymentRecord.priceId}`);
  }

  const creditPackage = getCreditPackageById(zpayPrice.packageId);
  if (!creditPackage || creditPackage.disabled) {
    throw new Error(`Credit package ${zpayPrice.packageId} not found`);
  }

  const expectedAmount = getZpayCreditPackageAmountCny(zpayPrice.packageId);
  if (params.type !== zpayPrice.paymentMethod) {
    throw new Error(`ZPAY payment method mismatch for ${outTradeNo}`);
  }

  const notifiedAmount = normalizeZpayAmount(params.money);
  if (notifiedAmount !== expectedAmount) {
    throw new Error(
      `ZPAY amount mismatch for ${outTradeNo}: ${notifiedAmount} !== ${expectedAmount}`
    );
  }

  const order = await queryZpayOrder(outTradeNo, config);
  if (String(order.code) !== '1' || String(order.status) !== '1') {
    throw new Error(`ZPAY order ${outTradeNo} is not paid`);
  }
  if (String(order.type) !== zpayPrice.paymentMethod) {
    throw new Error(
      `ZPAY order query payment method mismatch for ${outTradeNo}`
    );
  }
  if (String(order.out_trade_no) !== outTradeNo) {
    throw new Error('ZPAY order query returned a different out_trade_no');
  }
  if (normalizeZpayAmount(String(order.money)) !== expectedAmount) {
    throw new Error(`ZPAY order query amount mismatch for ${outTradeNo}`);
  }

  const existingCredit = await db
    .select({ id: creditTransaction.id })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, paymentRecord.userId),
        eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.PURCHASE_PACKAGE),
        eq(creditTransaction.referenceType, 'zpay_order'),
        eq(creditTransaction.referenceId, outTradeNo)
      )
    )
    .limit(1);

  const processed = await settleVerifiedZpayPayment({
    paymentAlreadyPaid: paymentRecord.paid,
    creditAlreadyGranted: existingCredit.length > 0,
    grantCredits: () =>
      addCredits({
        userId: paymentRecord.userId,
        amount: creditPackage.amount,
        type: CREDIT_TRANSACTION_TYPE.PURCHASE_PACKAGE,
        description: `+${creditPackage.amount} credits via ZPAY ${zpayPrice.paymentMethod} (${expectedAmount} CNY)`,
        priceId: paymentRecord.priceId,
        referenceType: 'zpay_order',
        referenceId: outTradeNo,
        expireDays: creditPackage.expireDays,
      }),
    markPaymentCompleted: async () => {
      await db
        .update(payment)
        .set({
          paid: true,
          status: 'completed',
          invoiceId: params.trade_no || null,
          updatedAt: new Date(),
        })
        .where(eq(payment.id, paymentRecord.id));
    },
  });

  return { outTradeNo, processed };
}

export async function handleZpayReturn(
  input: URLSearchParams | Record<string, unknown>
): Promise<{ outTradeNo: string | null; locale: Locale | null }> {
  const params = normalizeZpayParams(input);
  const outTradeNo = params.out_trade_no ?? null;
  const locale = getZpayLocaleFromParam(params.param);

  if (params.trade_status === 'TRADE_SUCCESS' && params.sign) {
    try {
      await handleZpayNotification(params);
    } catch (error) {
      console.warn('ZPAY return processing deferred to webhook:', error);
    }
  }

  return { outTradeNo, locale };
}
