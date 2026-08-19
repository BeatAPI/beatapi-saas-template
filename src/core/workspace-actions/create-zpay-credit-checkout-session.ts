import { createServerFn } from '@tanstack/react-start';
import { getLocale } from '@/core/workspace-lib/shims/next-intl-server';
import { requireSession } from '@/core/workspace-lib/session';
import { z } from 'zod';

type ZpayPaymentMethod = 'alipay' | 'wxpay';

const zpayCreditCheckoutSchema = z.object({
  packageId: z.string().min(1, { error: 'Package ID is required' }),
  paymentMethod: z.enum(['alipay', 'wxpay']),
});

/**
 * Create a Zpay (alipay/wxpay) credit checkout session.
 *
 * Migrated from BeatAPI's next-safe-action `createZpayCreditCheckoutAction`.
 * `getLocale()` is paraglide's synchronous getter via the shim.
 */
export const createZpayCreditCheckoutSessionFn = createServerFn()
  .inputValidator(zpayCreditCheckoutSchema)
  .handler(async ({ data }) => {
    try {
      const session = await requireSession();
      const currentUser = session.user;

      const locale = getLocale();
      const { createZpayCreditCheckout } = await import(
        '@/core/workspace-lib/payment/provider/zpay'
      );
      const result = await createZpayCreditCheckout({
        packageId: data.packageId,
        paymentMethod: data.paymentMethod as ZpayPaymentMethod,
        userId: currentUser.id,
        locale,
      });

      return {
        success: true as const,
        data: result,
      };
    } catch (error) {
      console.error('create zpay credit checkout session error:', error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
