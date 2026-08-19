type ZpaySettlementDependencies = {
  paymentAlreadyPaid: boolean;
  creditAlreadyGranted: boolean;
  grantCredits: () => Promise<void>;
  markPaymentCompleted: () => Promise<void>;
};

/**
 * Settle a provider-verified ZPay order in a recoverable order.
 *
 * Credits are written first with the order id as an idempotency key. If the
 * process stops before the payment row is updated, the next callback observes
 * the existing credit entry and finishes the payment update. A credit failure
 * therefore leaves the payment retryable instead of permanently completed.
 */
export async function settleVerifiedZpayPayment({
  paymentAlreadyPaid,
  creditAlreadyGranted,
  grantCredits,
  markPaymentCompleted,
}: ZpaySettlementDependencies): Promise<boolean> {
  if (paymentAlreadyPaid) return false;

  if (!creditAlreadyGranted) {
    await grantCredits();
  }

  await markPaymentCompleted();
  return !creditAlreadyGranted;
}
