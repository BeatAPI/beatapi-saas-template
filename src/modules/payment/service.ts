import { eq, and, desc, isNull } from 'drizzle-orm';
import { PaymentManager } from '@/core/payment';
import type { PaymentOrder, CheckoutSession, PaymentEvent } from '@/core/payment/types';
import { PaymentStatus, PaymentType } from '@/core/payment/types';
import { getUuid, getUniSeq, getSnowId } from '@/lib/hash';
import { db } from '@/core/db';
import {
  order,
  subscription,
  credit,
  paymentWebhookEvent,
} from '@/config/db/schema';
import { envConfigs } from '@/config';
import {
  SubscriptionStatus,
  type NewSubscription,
  type UpdateSubscription,
  findByProviderSubscriptionId,
  findBySubscriptionNo,
  updateBySubscriptionNo,
} from '@/modules/subscriptions/service';
import { calculateCreditExpirationTime } from '@/modules/credits/service';
import { getAllConfigs } from '@/modules/config/service';
import {
  buildPaymentManager,
  paymentManagerConfigFingerprint,
} from './provider-config';
import { addCredits as addWorkspaceCredits } from '@/core/workspace-credits/credits';
import { CREDIT_TRANSACTION_TYPE } from '@/core/workspace-credits/types';

// --- Order types ---

enum OrderStatus {
  PENDING = 'pending',
  CREATED = 'created',
  PAID = 'paid',
  FAILED = 'failed',
}

// --- Payment Manager ---

let manager: PaymentManager | null = null;
let managerConfigHash = '';

async function getPaymentManager(): Promise<PaymentManager> {
  const configs = await getAllConfigs();
  const hash = paymentManagerConfigFingerprint(configs);
  if (manager && hash === managerConfigHash) return manager;

  manager = buildPaymentManager(configs);
  managerConfigHash = hash;

  return manager;
}

// --- Checkout ---

export async function createCheckout(params: {
  userId: string;
  userEmail?: string;
  localProductId: string;
  paymentOrder: PaymentOrder;
  provider?: string;
  productName?: string;
  planName?: string;
  credits?: number;
  creditsValidDays?: number;
}): Promise<CheckoutSession> {
  const {
    userId,
    userEmail,
    localProductId,
    paymentOrder,
    provider,
    productName,
    planName,
    credits,
    creditsValidDays,
  } = params;
  const pm = await getPaymentManager();
  const orderNo = getUniSeq('ORD');

  const finalSuccessUrl = paymentOrder.successUrl || `${envConfigs.app_url}/settings/billing?success=1`;
  const callbackSuccessUrl = `${envConfigs.app_url}/api/payment/callback?order_no=${orderNo}&redirect=${encodeURIComponent(finalSuccessUrl)}`;

  const session = await pm.createPayment({
    order: {
      ...paymentOrder,
      orderNo,
      metadata: {
        ...paymentOrder.metadata,
        localOrderNo: orderNo,
        localProductId,
        userId,
        userEmail: userEmail || '',
      },
      successUrl: callbackSuccessUrl,
      cancelUrl: paymentOrder.cancelUrl || `${envConfigs.app_url}/settings/billing?canceled=1`,
    },
    provider,
  });

  await db().insert(order).values({
    id: getUuid(),
    orderNo,
    userId,
    userEmail: userEmail || '',
    status: OrderStatus.CREATED,
    amount: paymentOrder.price?.amount || 0,
    currency: paymentOrder.price?.currency || 'usd',
    productId: localProductId,
    productName: productName || null,
    planName: planName || null,
    creditsAmount: credits ?? null,
    creditsValidDays: creditsValidDays ?? null,
    paymentType: paymentOrder.type || 'one-time',
    paymentProvider: session.provider,
    paymentSessionId: session.checkoutInfo.sessionId,
    checkoutInfo: JSON.stringify(session.checkoutInfo),
    checkoutResult: JSON.stringify(session.checkoutResult),
    checkoutUrl: session.checkoutInfo.checkoutUrl,
    description: paymentOrder.description || '',
  });

  return session;
}

// --- Payment callback (return_url) ---

export async function handlePaymentCallback(orderNo: string) {
  // Find the order
  const [existingOrder] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo))
    .limit(1);

  if (!existingOrder) return;
  if (existingOrder.status === OrderStatus.PAID) {
    await syncWorkspaceCreditsForOrder(existingOrder);
    return;
  }

  // Query the payment provider for latest status
  const pm = await getPaymentManager();
  const provider = pm.getProvider(existingOrder.paymentProvider);
  if (!provider) return;

  const session = await provider.getPaymentSession({
    sessionId: existingOrder.paymentSessionId || existingOrder.orderNo,
  });

  // Reuse the same atomic success handler as the webhook so that
  // subscriptions are created and credits granted on synchronous return too.
  // This is important in environments where webhooks aren't reachable (e.g. localhost).
  await handleCheckoutSuccess(session, existingOrder.paymentProvider);
}

// --- Webhook handling ---

export async function handleWebhook(params: {
  req: Request;
  provider: string;
}): Promise<PaymentEvent> {
  const pm = await getPaymentManager();
  const event = await pm.getPaymentEvent({ req: params.req, provider: params.provider });
  let claimedEventId: string | null = null;
  if (event.externalEventId) {
    claimedEventId = getUuid();
    const inserted = await db()
      .insert(paymentWebhookEvent)
      .values({
        id: claimedEventId,
        provider: params.provider,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        payload: JSON.stringify(event.eventResult),
        status: 'processing',
      })
      .onConflictDoNothing()
      .returning({ id: paymentWebhookEvent.id });
    if (!inserted.length) return event;
  }

  const session = event.paymentSession;
  if (!session) {
    if (claimedEventId) {
      await db()
        .update(paymentWebhookEvent)
        .set({ status: 'ignored', processedAt: new Date() })
        .where(eq(paymentWebhookEvent.id, claimedEventId));
    }
    return event;
  }

  try {
    const eventType = event.eventType;
    if (eventType === 'checkout.success' || eventType === 'payment.success') {
      await handleCheckoutSuccess(session, params.provider);
    } else if (eventType === 'subscribe.updated') {
      await handleSubscriptionUpdated(session, params.provider);
    } else if (eventType === 'subscribe.canceled') {
      await handleSubscriptionCanceled(session, params.provider);
    }
    if (claimedEventId) {
      await db()
        .update(paymentWebhookEvent)
        .set({ status: 'processed', processedAt: new Date() })
        .where(eq(paymentWebhookEvent.id, claimedEventId));
    }
  } catch (error) {
    if (claimedEventId) {
      await db()
        .delete(paymentWebhookEvent)
        .where(eq(paymentWebhookEvent.id, claimedEventId));
    }
    throw error;
  }

  return event;
}

// --- Checkout Success: update order + create subscription + grant credits ---

async function handleCheckoutSuccess(session: any, provider: string) {
  // Different providers expose the session identifier under different keys.
  // We try the common shapes; for Alipay the natural key is out_trade_no
  // (which equals our orderNo and the value we stored in paymentSessionId).
  const result = session.paymentResult || {};
  const sessionId: string =
    result.id ||
    result.object?.id ||
    result.out_trade_no ||
    result.outTradeNo ||
    '';
  const localOrderNo = String(session.metadata?.localOrderNo || '');
  if (!sessionId && !localOrderNo) return;

  // Prefer the local order number propagated through provider custom data.
  const [existingOrder] = await db()
    .select()
    .from(order)
    .where(
      and(
        localOrderNo
          ? eq(order.orderNo, localOrderNo)
          : eq(order.paymentSessionId, sessionId),
        eq(order.paymentProvider, provider),
        isNull(order.deletedAt)
      )
    )
    .limit(1);

  if (!existingOrder) return;

  // Idempotency: skip if already paid
  if (existingOrder.status === OrderStatus.PAID) return;
  if (existingOrder.status !== OrderStatus.CREATED && existingOrder.status !== OrderStatus.PENDING) return;

  const paymentInfo = session.paymentInfo;
  const subscriptionInfo = session.subscriptionInfo;

  if (session.paymentStatus === PaymentStatus.SUCCESS) {
    // Prepare order update
    const orderUpdate: Record<string, any> = {
      status: OrderStatus.PAID,
      paymentResult: JSON.stringify(session.paymentResult),
      paymentAmount: paymentInfo?.paymentAmount || null,
      paymentCurrency: paymentInfo?.paymentCurrency || null,
      paymentEmail: paymentInfo?.paymentEmail || null,
      paidAt: paymentInfo?.paidAt || new Date(),
      transactionId: paymentInfo?.transactionId || null,
      invoiceId: paymentInfo?.invoiceId || null,
      invoiceUrl: paymentInfo?.invoiceUrl || null,
      paymentUserName: paymentInfo?.paymentUserName || null,
      paymentUserId: paymentInfo?.paymentUserId || null,
      discountCode: paymentInfo?.discountCode || null,
      discountAmount: paymentInfo?.discountAmount || null,
    };

    // Atomically update order + create subscription + grant credits
    await db().transaction(async (tx: any) => {
      // 1. Create subscription if applicable
      if (subscriptionInfo && session.subscriptionId) {
        const subNo = getSnowId();
        const newSub: any = {
          id: getUuid(),
          subscriptionNo: subNo,
          userId: existingOrder.userId,
          userEmail: existingOrder.userEmail || existingOrder.paymentEmail || '',
          status: subscriptionInfo.status || SubscriptionStatus.ACTIVE,
          paymentProvider: provider,
          subscriptionId: session.subscriptionId,
          subscriptionResult: JSON.stringify(session.subscriptionResult),
          productId: existingOrder.productId,
          description: subscriptionInfo.description || 'Subscription Created',
          amount: subscriptionInfo.amount,
          currency: subscriptionInfo.currency,
          interval: subscriptionInfo.interval,
          intervalCount: subscriptionInfo.intervalCount,
          trialPeriodDays: subscriptionInfo.trialPeriodDays,
          currentPeriodStart: subscriptionInfo.currentPeriodStart,
          currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
          billingUrl: subscriptionInfo.billingUrl,
          planName: existingOrder.planName || existingOrder.productName,
          productName: existingOrder.productName,
          creditsAmount: existingOrder.creditsAmount,
          creditsValidDays: existingOrder.creditsValidDays,
          paymentProductId: existingOrder.paymentProductId,
          paymentUserId: paymentInfo?.paymentUserId,
        };
        await tx.insert(subscription).values(newSub);
        orderUpdate.subscriptionNo = subNo;
        orderUpdate.subscriptionId = session.subscriptionId;
        orderUpdate.subscriptionResult = JSON.stringify(session.subscriptionResult);
      }

      // 2. Grant credits if applicable
      if (existingOrder.creditsAmount && existingOrder.creditsAmount > 0) {
        const credits = existingOrder.creditsAmount;
        const expiresAt = calculateCreditExpirationTime({
          creditsValidDays: existingOrder.creditsValidDays || 0,
          currentPeriodEnd: subscriptionInfo?.currentPeriodEnd,
        });

        await tx.insert(credit).values({
          id: getUuid(),
          userId: existingOrder.userId,
          userEmail: existingOrder.userEmail || '',
          orderNo: existingOrder.orderNo,
          subscriptionNo: orderUpdate.subscriptionNo || '',
          transactionNo: getSnowId(),
          transactionType: 'grant',
          transactionScene: existingOrder.paymentType === 'subscription' ? 'subscription' : 'payment',
          credits,
          remainingCredits: credits,
          description: 'Grant credit',
          expiresAt,
          status: 'active',
        });
      }

      // 3. Update order
      await tx.update(order).set(orderUpdate).where(eq(order.id, existingOrder.id));
    });
    await syncWorkspaceCreditsForOrder(existingOrder);
  } else if (session.paymentStatus === PaymentStatus.FAILED || session.paymentStatus === PaymentStatus.CANCELED) {
    await db().update(order).set({
      status: OrderStatus.FAILED,
      paymentResult: JSON.stringify(session.paymentResult),
    }).where(eq(order.id, existingOrder.id));
  }
}

// --- Subscription Renewal ---

export async function handleSubscriptionRenewal(session: any, provider: string) {
  if (!session.subscriptionId || !session.subscriptionInfo) return;

  const existingSub = await findByProviderSubscriptionId({
    provider,
    subscriptionId: session.subscriptionId,
  });
  if (!existingSub || !existingSub.amount || !existingSub.currency) return;

  const subscriptionInfo = session.subscriptionInfo;
  if (!subscriptionInfo.currentPeriodStart || !subscriptionInfo.currentPeriodEnd) return;

  if (session.paymentStatus !== PaymentStatus.SUCCESS) return;

  const paymentInfo = session.paymentInfo;

  // Idempotency: drop duplicate renewals for the same provider transaction.
  if (paymentInfo?.transactionId) {
    const [dup] = await db()
      .select({ id: order.id })
      .from(order)
      .where(
        and(
          eq(order.transactionId, paymentInfo.transactionId),
          eq(order.paymentProvider, provider)
        )
      )
      .limit(1);
    if (dup) return;
  }

  const renewalOrderNo = getSnowId();

  await db().transaction(async (tx: any) => {
    // 1. Update subscription period
    await tx.update(subscription).set({
      currentPeriodStart: subscriptionInfo.currentPeriodStart,
      currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
    }).where(eq(subscription.subscriptionNo, existingSub.subscriptionNo));

    // 2. Create renewal order
    await tx.insert(order).values({
      id: getUuid(),
      orderNo: renewalOrderNo,
      userId: existingSub.userId,
      userEmail: existingSub.userEmail || '',
      status: OrderStatus.PAID,
      amount: existingSub.amount,
      currency: existingSub.currency,
      productId: existingSub.productId || '',
      paymentType: 'renew',
      paymentInterval: existingSub.interval || '',
      paymentProvider: provider,
      checkoutInfo: '',
      description: 'Subscription Renewal',
      productName: existingSub.productName || '',
      planName: existingSub.planName || '',
      creditsAmount: existingSub.creditsAmount,
      creditsValidDays: existingSub.creditsValidDays,
      paymentProductId: existingSub.paymentProductId || '',
      paymentResult: JSON.stringify(session.paymentResult),
      paymentAmount: paymentInfo?.paymentAmount,
      paymentCurrency: paymentInfo?.paymentCurrency,
      paymentEmail: paymentInfo?.paymentEmail,
      paidAt: paymentInfo?.paidAt || new Date(),
      invoiceId: paymentInfo?.invoiceId,
      invoiceUrl: paymentInfo?.invoiceUrl,
      subscriptionNo: existingSub.subscriptionNo,
      subscriptionId: session.subscriptionId,
      transactionId: paymentInfo?.transactionId,
      paymentUserName: paymentInfo?.paymentUserName,
      paymentUserId: paymentInfo?.paymentUserId,
    });

    // 3. Grant credits for renewal
    if (existingSub.creditsAmount && existingSub.creditsAmount > 0) {
      const credits = existingSub.creditsAmount;
      const expiresAt = calculateCreditExpirationTime({
        creditsValidDays: existingSub.creditsValidDays || 0,
        currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
      });

      await tx.insert(credit).values({
        id: getUuid(),
        userId: existingSub.userId,
        userEmail: existingSub.userEmail || '',
        orderNo: renewalOrderNo,
        subscriptionNo: existingSub.subscriptionNo,
        transactionNo: getSnowId(),
        transactionType: 'grant',
        transactionScene: 'renewal',
        credits,
        remainingCredits: credits,
        description: 'Grant credit',
        expiresAt,
        status: 'active',
      });
    }
  });

  if (existingSub.creditsAmount && existingSub.creditsAmount > 0) {
    await addWorkspaceCredits({
      userId: existingSub.userId,
      amount: existingSub.creditsAmount,
      type: CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_RENEWAL,
      description: `Subscription renewal credits: ${existingSub.creditsAmount}`,
      expireDays: existingSub.creditsValidDays || undefined,
      referenceType: 'invoice',
      referenceId: renewalOrderNo,
    });
  }
}

async function syncWorkspaceCreditsForOrder(existingOrder: {
  userId: string;
  orderNo: string;
  paymentType?: string | null;
  creditsAmount?: number | null;
  creditsValidDays?: number | null;
}) {
  if (!existingOrder.creditsAmount || existingOrder.creditsAmount <= 0) return;

  await addWorkspaceCredits({
    userId: existingOrder.userId,
    amount: existingOrder.creditsAmount,
    type:
      existingOrder.paymentType === 'subscription'
        ? CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_PLAN_CHANGE
        : CREDIT_TRANSACTION_TYPE.PURCHASE_PACKAGE,
    description: `Payment credits: ${existingOrder.creditsAmount}`,
    expireDays: existingOrder.creditsValidDays || undefined,
    referenceType: 'invoice',
    referenceId: existingOrder.orderNo,
  });
}

// --- Subscription Updated ---

async function handleSubscriptionUpdated(session: any, provider: string) {
  if (!session.subscriptionId || !session.subscriptionInfo) return;

  const existingSub = await findByProviderSubscriptionId({
    provider,
    subscriptionId: session.subscriptionId,
  });
  if (!existingSub) return;

  const info = session.subscriptionInfo;
  await updateBySubscriptionNo(existingSub.subscriptionNo, {
    status: info.status,
    currentPeriodStart: info.currentPeriodStart,
    currentPeriodEnd: info.currentPeriodEnd,
    canceledAt: info.canceledAt || null,
    canceledEndAt: info.canceledEndAt || null,
    canceledReason: info.canceledReason || '',
    canceledReasonType: info.canceledReasonType || '',
  });
}

// --- Subscription Canceled ---

async function handleSubscriptionCanceled(session: any, provider: string) {
  if (!session.subscriptionId || !session.subscriptionInfo) return;

  const existingSub = await findByProviderSubscriptionId({
    provider,
    subscriptionId: session.subscriptionId,
  });
  if (!existingSub) return;

  const info = session.subscriptionInfo;
  await updateBySubscriptionNo(existingSub.subscriptionNo, {
    status: SubscriptionStatus.CANCELED,
    canceledAt: info.canceledAt,
    canceledEndAt: info.canceledEndAt,
    canceledReason: info.canceledReason,
    canceledReasonType: info.canceledReasonType,
  });
}

// --- Cancel subscription (user-initiated) ---

export async function cancelUserSubscription(params: {
  userId: string;
  subscriptionNo: string;
}) {
  const { userId, subscriptionNo } = params;

  const sub = await findBySubscriptionNo(subscriptionNo);
  if (!sub) throw new Error('Subscription not found');
  if (sub.userId !== userId) throw new Error('Forbidden');

  if (
    sub.status === SubscriptionStatus.CANCELED ||
    sub.status === SubscriptionStatus.EXPIRED
  ) {
    return sub;
  }

  const pm = await getPaymentManager();
  const provider = pm.getProvider(sub.paymentProvider);
  if (!provider || !provider.cancelSubscription) {
    throw new Error('Cancellation not supported for this provider');
  }

  const session = await provider.cancelSubscription({
    subscriptionId: sub.subscriptionId,
  });

  const info = session.subscriptionInfo;
  const updated = await updateBySubscriptionNo(subscriptionNo, {
    status: info?.status || SubscriptionStatus.CANCELED,
    canceledAt: info?.canceledAt || new Date(),
    canceledEndAt: info?.canceledEndAt || null,
    canceledReason: info?.canceledReason || 'Canceled by user',
    canceledReasonType: info?.canceledReasonType || 'user_request',
  });

  return updated;
}

// --- Query helpers ---

export async function getUserOrders(userId: string) {
  return db()
    .select()
    .from(order)
    .where(and(eq(order.userId, userId), isNull(order.deletedAt)))
    .orderBy(desc(order.createdAt));
}
