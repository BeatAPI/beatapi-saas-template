import type { payment } from '@/config/db/schema';

export type PaymentLifecycleStatus =
  | 'processing'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'not_found';

type PaymentLike = Pick<typeof payment.$inferSelect, 'status' | 'paid'>;

export function resolvePaymentLifecycleStatus(
  paymentRecord: PaymentLike | null
): PaymentLifecycleStatus {
  if (!paymentRecord) {
    return 'not_found';
  }

  if (paymentRecord.paid) {
    return 'paid';
  }

  if (
    paymentRecord.status === 'failed' ||
    paymentRecord.status === 'canceled' ||
    paymentRecord.status === 'unpaid'
  ) {
    return 'failed';
  }

  if (paymentRecord.status === 'expired') {
    return 'expired';
  }

  return 'processing';
}
