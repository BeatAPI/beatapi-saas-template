import { createFileRoute } from '@tanstack/react-router';

import { BeatApiPricingPage } from '@/components/pricing/beatapi-pricing-page';
import { getLocale } from '@/paraglide/runtime.js';

function PricingPage() {
  const { locale } = Route.useLoaderData();
  return <BeatApiPricingPage locale={locale} />;
}

export const Route = createFileRoute('/pricing')({
  loader: () => ({ locale: getLocale() }),
  head: () => ({
    meta: [
      { title: 'Pricing · BeatAPI' },
      {
        name: 'description',
        content: 'Simple one-time BeatAPI plans for image and video creation.',
      },
    ],
  }),
  component: PricingPage,
});
