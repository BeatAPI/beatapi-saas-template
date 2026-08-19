import type {
  ChangeSubscriptionParams,
  ChangeSubscriptionResult,
  CheckoutResult,
  CreateCheckoutParams,
  CreateCreditCheckoutParams,
  CreatePortalParams,
  PaymentProvider,
  PortalResult,
} from './types';

const ZPAY_ONLY_PAYMENT_ERROR =
  'Stripe payments are disabled for this launch. Use the ZPAY credit checkout flow.';

/**
 * Global payment provider instance
 */
let paymentProvider: PaymentProvider | null = null;

/**
 * Get the payment provider
 * @returns current payment provider instance
 * @throws Error if provider is not initialized
 */
export const getPaymentProvider = (): PaymentProvider => {
  if (!paymentProvider) {
    return initializePaymentProvider();
  }
  return paymentProvider;
};

/**
 * Initialize the payment provider
 * @returns initialized payment provider
 */
export const initializePaymentProvider = (): PaymentProvider => {
  if (!paymentProvider) {
    paymentProvider = {
      createCheckout: async (): Promise<CheckoutResult> => {
        throw new Error(ZPAY_ONLY_PAYMENT_ERROR);
      },
      createCreditCheckout: async (): Promise<CheckoutResult> => {
        throw new Error(ZPAY_ONLY_PAYMENT_ERROR);
      },
      createCustomerPortal: async (): Promise<PortalResult> => {
        throw new Error(ZPAY_ONLY_PAYMENT_ERROR);
      },
      changeSubscription: async (): Promise<ChangeSubscriptionResult> => {
        throw new Error(ZPAY_ONLY_PAYMENT_ERROR);
      },
      handleWebhookEvent: async (): Promise<void> => {
        throw new Error(ZPAY_ONLY_PAYMENT_ERROR);
      },
    };
  }
  return paymentProvider;
};

/**
 * Create a checkout session for a plan
 * @param params Parameters for creating the checkout session
 * @returns Checkout result
 */
export const createCheckout = async (
  params: CreateCheckoutParams
): Promise<CheckoutResult> => {
  const provider = getPaymentProvider();
  return provider.createCheckout(params);
};

/**
 * Create a checkout session for a credit package
 * @param params Parameters for creating the checkout session
 * @returns Checkout result
 */
export const createCreditCheckout = async (
  params: CreateCreditCheckoutParams
): Promise<CheckoutResult> => {
  const provider = getPaymentProvider();
  return provider.createCreditCheckout(params);
};

/**
 * Create a customer portal session
 * @param params Parameters for creating the portal
 * @returns Portal result
 */
export const createCustomerPortal = async (
  params: CreatePortalParams
): Promise<PortalResult> => {
  const provider = getPaymentProvider();
  return provider.createCustomerPortal(params);
};

/**
 * Change an existing subscription
 * @param params Parameters for the subscription change
 * @returns Change result
 */
export const changeSubscription = async (
  params: ChangeSubscriptionParams
): Promise<ChangeSubscriptionResult> => {
  const provider = getPaymentProvider();
  return provider.changeSubscription(params);
};

/**
 * Handle webhook event
 * @param payload Raw webhook payload
 * @param signature Webhook signature
 */
export const handleWebhookEvent = async (
  payload: string,
  signature: string
): Promise<void> => {
  const provider = getPaymentProvider();
  await provider.handleWebhookEvent(payload, signature);
};
