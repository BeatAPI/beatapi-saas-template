import {
  PaymentEventType,
  PaymentInterval,
  PaymentStatus,
  SubscriptionStatus,
  type CheckoutSession,
  type PaymentConfigs,
  type PaymentEvent,
  type PaymentOrder,
  type PaymentProvider,
  type PaymentSession,
} from './types';
import { constantTimeHexEqual, hmacSha256Hex } from './webhook-signature';

export interface PaddleConfigs extends PaymentConfigs {
  apiKey: string;
  webhookSecret: string;
  environment?: 'sandbox' | 'production';
}

export class PaddleProvider implements PaymentProvider {
  readonly name = 'paddle';
  configs: PaddleConfigs;
  private baseUrl: string;

  constructor(configs: PaddleConfigs) {
    this.configs = configs;
    this.baseUrl =
      configs.environment === 'production'
        ? 'https://api.paddle.com'
        : 'https://sandbox-api.paddle.com';
  }

  async createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession> {
    if (!order.productId) throw new Error('Paddle price ID is required');
    const payload = {
      items: [{ price_id: order.productId, quantity: order.quantity || 1 }],
      collection_mode: 'automatic',
      custom_data: order.metadata || {},
    };
    const result = await this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const transaction = result.data;
    if (!transaction?.id || !transaction.checkout?.url) {
      throw new Error('Paddle did not return a checkout URL. Configure a default payment link.');
    }
    return {
      provider: this.name,
      checkoutParams: payload,
      checkoutInfo: {
        sessionId: transaction.id,
        checkoutUrl: transaction.checkout.url,
      },
      checkoutResult: transaction,
      metadata: order.metadata || {},
    };
  }

  async getPaymentSession({ sessionId }: { sessionId: string }): Promise<PaymentSession> {
    const result = await this.request(`/transactions/${sessionId}`);
    return this.buildSession('transaction.updated', result.data);
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const signature = req.headers.get('paddle-signature') || '';
    const parts = Object.fromEntries(
      signature.split(';').map((part) => {
        const [key, value] = part.split('=');
        return [key, value];
      })
    );
    const timestamp = parts.ts;
    const provided = parts.h1;
    if (!rawBody || !timestamp || !provided || !this.configs.webhookSecret) {
      throw new Error('Invalid Paddle webhook request');
    }
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      throw new Error('Expired Paddle webhook signature');
    }
    const expected = await hmacSha256Hex(
      this.configs.webhookSecret,
      `${timestamp}:${rawBody}`
    );
    if (!constantTimeHexEqual(expected, provided)) {
      throw new Error('Invalid Paddle webhook signature');
    }

    const event = JSON.parse(rawBody);
    return {
      externalEventId: String(event.event_id || ''),
      eventType: this.mapEvent(String(event.event_type || '')),
      eventResult: event,
      paymentSession: this.buildSession(event.event_type, event.data),
    };
  }

  private buildSession(eventType: string, data: any): PaymentSession {
    const status = String(data?.status || '');
    const totals = data?.details?.totals || data?.totals || {};
    const isSubscription = String(data?.id || '').startsWith('sub_');
    return {
      provider: this.name,
      paymentStatus:
        eventType === 'transaction.payment_failed'
          ? PaymentStatus.FAILED
          : ['completed', 'paid', 'active', 'canceled', 'paused'].includes(status)
            ? PaymentStatus.SUCCESS
            : PaymentStatus.PROCESSING,
      paymentInfo: {
        transactionId: String(
          isSubscription ? data?.transaction_id || '' : data?.id || ''
        ),
        paymentAmount: Number(totals.total || 0),
        paymentCurrency: String(data?.currency_code || 'USD').toLowerCase(),
        paymentUserId: String(data?.customer_id || ''),
        paidAt: new Date(data?.billed_at || data?.created_at || Date.now()),
      },
      paymentResult: { ...data, id: String(data?.id || '') },
      subscriptionId: isSubscription
        ? String(data.id)
        : data?.subscription_id
          ? String(data.subscription_id)
          : undefined,
      subscriptionInfo:
        isSubscription || data?.subscription_id
          ? {
              subscriptionId: String(data?.subscription_id || data?.id),
              currentPeriodStart: new Date(data?.current_billing_period?.starts_at || Date.now()),
              currentPeriodEnd: new Date(data?.current_billing_period?.ends_at || Date.now()),
              status: this.mapSubscriptionStatus(status),
              interval: PaymentInterval.MONTH,
            }
          : undefined,
      subscriptionResult: isSubscription ? data : undefined,
      metadata: {
        ...(data?.custom_data || {}),
        externalTransactionId: String(data?.id || ''),
      },
    };
  }

  private mapEvent(eventType: string): PaymentEventType {
    if (eventType === 'transaction.completed') return PaymentEventType.CHECKOUT_SUCCESS;
    if (eventType === 'transaction.paid') return PaymentEventType.PAYMENT_SUCCESS;
    if (eventType === 'subscription.canceled') return PaymentEventType.SUBSCRIBE_CANCELED;
    if (eventType.startsWith('subscription.')) return PaymentEventType.SUBSCRIBE_UPDATED;
    return PaymentEventType.PAYMENT_FAILED;
  }

  private mapSubscriptionStatus(status: string): SubscriptionStatus {
    if (status === 'canceled') return SubscriptionStatus.CANCELED;
    if (status === 'paused') return SubscriptionStatus.PAUSED;
    if (status === 'past_due') return SubscriptionStatus.PENDING_CANCEL;
    return SubscriptionStatus.ACTIVE;
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.configs.apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error?.detail || `Paddle request failed (${response.status})`);
    }
    return result;
  }
}
