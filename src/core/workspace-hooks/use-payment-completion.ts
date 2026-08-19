import { checkPaymentCompletionFn } from '@/core/workspace-actions/check-payment-completion';
import { PAYMENT_POLL_INTERVAL } from '@/core/workspace-lib/constants';
import type { PaymentLifecycleStatus } from '@/core/workspace-lib/payment-status';
import { useQuery } from '@tanstack/react-query';

// Query keys for payment completion
export const paymentCompletionKeys = {
  all: ['paymentCompletion'] as const,
  session: (sessionId: string) =>
    [...paymentCompletionKeys.all, 'session', sessionId] as const,
};

// Hook to check if payment is completed by session ID
export function usePaymentCompletion(
  sessionId: string | null,
  enablePolling = false
) {
  return useQuery({
    queryKey: paymentCompletionKeys.session(sessionId || ''),
    queryFn: async () => {
      if (!sessionId) {
        return {
          isPaid: false,
          status: 'not_found' as PaymentLifecycleStatus,
        };
      }
      const result = await checkPaymentCompletionFn({ data: { sessionId } });
      if (!result?.success) {
        throw new Error(
          result?.error || 'Failed to check payment completion'
        );
      }

      const { isPaid, status } = result;
      return {
        isPaid,
        status,
      };
    },
    enabled: !!sessionId,
    refetchInterval: enablePolling ? PAYMENT_POLL_INTERVAL : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
