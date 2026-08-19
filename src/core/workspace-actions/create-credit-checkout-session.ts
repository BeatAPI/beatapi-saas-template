import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { websiteConfig } from '@/core/workspace-lib/website';
import { getCreditPackageById } from '@/core/workspace-credits/server';
import { getUrlWithLocale } from '@/core/workspace-lib/urls/urls';
import { createCreditCheckout } from '@/core/workspace-lib/payment';
import type { CreateCreditCheckoutParams } from '@/core/workspace-lib/payment/types';
import { Routes } from '@/core/workspace-lib/shims/routes';
import { getLocale } from '@/core/workspace-lib/shims/next-intl-server';
import { requireSession } from '@/core/workspace-lib/session';
import { z } from 'zod';

// Credit checkout schema for validation
// metadata is optional, and may contain referral information if you need
const creditCheckoutSchema = z.object({
  packageId: z.string().min(1, { error: 'Package ID is required' }),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * Create a checkout session for a credit package.
 *
 * Migrated from BeatAPI's next-safe-action `createCreditCheckoutSession`.
 * Reads datafast cookies from the incoming request via getRequest()
 * (replacing Next's `cookies()` from `next/headers`).
 */
export const createCreditCheckoutSessionFn = createServerFn()
  .inputValidator(creditCheckoutSchema)
  .handler(async ({ data }) => {
    const { packageId, metadata } = data;

    try {
      const session = await requireSession();
      const currentUser = session.user;

      // Get the current locale from the request (paraglide runtime)
      const locale = getLocale();

      // Find the credit package
      const creditPackage = getCreditPackageById(packageId);
      if (!creditPackage) {
        return {
          success: false as const,
          error: 'Credit package not found',
        };
      }

      // Add metadata to identify this as a credit purchase
      const customMetadata: Record<string, string> = {
        ...(metadata ?? {}),
        type: 'credit_purchase',
        packageId,
        credits: creditPackage.amount.toString(),
        userId: currentUser.id,
        userName: currentUser.name ?? '',
      };

      // https://datafa.st/docs/stripe-checkout-api
      // if datafast analytics is enabled, read attribution cookies from the
      // incoming request (replaces Next's cookies() from next/headers).
      if (websiteConfig.features.enableDatafastRevenueTrack) {
        const cookieHeader = getRequest().headers.get('cookie') ?? '';
        const getCookie = (name: string): string => {
          const match = cookieHeader.match(
            new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
          );
          return match ? match[1] : '';
        };
        customMetadata.datafast_visitor_id = getCookie('datafast_visitor_id');
        customMetadata.datafast_session_id = getCookie('datafast_session_id');
      }

      // Create checkout session with payment processing URLs
      const successUrl = getUrlWithLocale(
        `${Routes.Payment}?session_id={CHECKOUT_SESSION_ID}&callback=${Routes.History}`,
        locale
      );
      const cancelUrl = getUrlWithLocale(Routes.History, locale);

      const params: CreateCreditCheckoutParams = {
        packageId,
        priceId: creditPackage.price.priceId,
        customerEmail: currentUser.email,
        metadata: customMetadata,
        successUrl,
        cancelUrl,
        locale,
      };

      const result = await createCreditCheckout(params);
      return {
        success: true as const,
        data: result,
      };
    } catch (error) {
      console.error('Create credit checkout session error:', error);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create checkout session',
      };
    }
  });
