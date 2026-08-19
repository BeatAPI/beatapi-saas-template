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

export interface LemonSqueezyConfigs extends PaymentConfigs {
  apiKey: string;
  storeId: string;
  signingSecret: string;
  testMode?: boolean;
}

export class LemonSqueezyProvider implements PaymentProvider {
  readonly name = 'lemonsqueezy';
  configs: LemonSqueezyConfigs;

  constructor(configs: LemonSqueezyConfigs) {
    this.configs = configs;
  }

  async createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession> {
    if (!order.productId) throw new Error('Lemon Squeezy variant ID is required');
    const payload = {
      data: {
        type: 'checkouts',
        attributes: {
          product_options: {
            redirect_url: order.successUrl,
            enabled_variants: [Number(order.productId)],
          },
          checkout_options: { embed: false },
          checkout_data: {
            email: order.customer?.email,
            name: order.customer?.name,
            custom: order.metadata || {},
          },
          test_mode: this.configs.testMode ?? false,
        },
        relationships: {
          store: { data: { type: 'stores', id: String(this.configs.storeId) } },
          variant: { data: { type: 'variants', id: String(order.productId) } },
        },
      },
    };
    const result = await this.request('/checkouts', { method: 'POST', body: JSON.stringify(payload) });
    const id = String(result.data?.id || '');
    const url = result.data?.attributes?.url;
    if (!id || !url) throw new Error('Lemon Squeezy did not return a checkout URL');
    return {
      provider: this.name,
      checkoutParams: payload,
      checkoutInfo: { sessionId: id, checkoutUrl: url },
      checkoutResult: result,
      metadata: order.metadata || {},
    };
  }

  async getPaymentSession({ sessionId }: { sessionId: string }): Promise<PaymentSession> {
    const result = await this.request(`/checkouts/${sessionId}`);
    return {
      provider: this.name,
      paymentStatus: PaymentStatus.PROCESSING,
      paymentResult: result.data,
      metadata: {
        checkoutId: sessionId,
        ...(result.data?.attributes?.checkout_data?.custom || {}),
      },
    };
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const provided = req.headers.get('x-signature') || '';
    if (!rawBody || !provided || !this.configs.signingSecret) {
      throw new Error('Invalid Lemon Squeezy webhook request');
    }
    const expected = await hmacSha256Hex(this.configs.signingSecret, rawBody);
    if (!constantTimeHexEqual(expected, provided)) {
      throw new Error('Invalid Lemon Squeezy webhook signature');
    }

    const event = JSON.parse(rawBody);
    const name = String(event.meta?.event_name || '');
    return {
      externalEventId:
        req.headers.get('x-event-id') ||
        `${name}:${event.data?.type || 'event'}:${event.data?.id || ''}:${event.data?.attributes?.updated_at || event.data?.attributes?.created_at || ''}`,
      eventType: this.mapEvent(name),
      eventResult: event,
      paymentSession: this.buildSession(event),
    };
  }

  private buildSession(event: any): PaymentSession {
    const data = event.data || {};
    const attributes = data.attributes || {};
    const custom = event.meta?.custom_data || {};
    const isSubscription = data.type === 'subscriptions';
    const amount = Number(attributes.total ?? attributes.subtotal ?? 0);
    const currency = String(attributes.currency || 'USD').toLowerCase();
    return {
      provider: this.name,
      paymentStatus:
        String(event.meta?.event_name || '').includes('failed')
          ? PaymentStatus.FAILED
          : PaymentStatus.SUCCESS,
      paymentInfo: {
        transactionId: String(attributes.order_id || data.id || ''),
        paymentAmount: amount,
        paymentCurrency: currency,
        paymentEmail: attributes.user_email,
        paymentUserId: String(attributes.customer_id || ''),
        paidAt: new Date(attributes.created_at || Date.now()),
      },
      paymentResult: { ...data, id: String(data.id || '') },
      subscriptionId: isSubscription ? String(data.id) : undefined,
      subscriptionInfo: isSubscription
        ? {
            subscriptionId: String(data.id),
            productId: String(attributes.variant_id || ''),
            currentPeriodStart: new Date(attributes.created_at || Date.now()),
            currentPeriodEnd: new Date(attributes.renews_at || attributes.ends_at || Date.now()),
            billingUrl: attributes.urls?.customer_portal,
            status: this.mapSubscriptionStatus(attributes.status),
            interval: PaymentInterval.MONTH,
          }
        : undefined,
      subscriptionResult: isSubscription ? data : undefined,
      metadata: { ...custom, externalTransactionId: String(data.id || '') },
    };
  }

  private mapEvent(name: string): PaymentEventType {
    if (name === 'order_created') return PaymentEventType.CHECKOUT_SUCCESS;
    if (name === 'subscription_payment_success') return PaymentEventType.PAYMENT_SUCCESS;
    if (['subscription_cancelled', 'subscription_expired'].includes(name)) {
      return PaymentEventType.SUBSCRIBE_CANCELED;
    }
    if (name.startsWith('subscription_')) return PaymentEventType.SUBSCRIBE_UPDATED;
    return PaymentEventType.PAYMENT_FAILED;
  }

  private mapSubscriptionStatus(status: string): SubscriptionStatus {
    if (status === 'cancelled') return SubscriptionStatus.CANCELED;
    if (status === 'expired') return SubscriptionStatus.EXPIRED;
    if (status === 'paused') return SubscriptionStatus.PAUSED;
    return SubscriptionStatus.ACTIVE;
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${this.configs.apiKey}`,
        ...(init.headers || {}),
      },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.errors?.[0]?.detail || `Lemon Squeezy request failed (${response.status})`);
    }
    return result;
  }
}
