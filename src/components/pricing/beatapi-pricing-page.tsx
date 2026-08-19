
import { PricingCreditPackGrid } from '@/components/pricing/pricing-credit-pack-grid';
import { BeatApiProductShell } from '@/components/marketing/beatapi-product-shell';

export function BeatApiPricingPage({ locale }: { locale: string }) {
  return (
    <BeatApiProductShell active="pricing" locale={locale}>
      <main className="relative pt-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(circle_at_50%_4%,rgba(255,107,26,0.09),transparent_31%),radial-gradient(circle_at_12%_58%,rgba(255,255,255,0.025),transparent_26%)]"
        />
        <div className="relative">
          <PricingCreditPackGrid variant="home" />
        </div>
      </main>
    </BeatApiProductShell>
  );
}
