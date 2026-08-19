import type { ReactNode } from 'react';

import { usePricingModal } from '@/components/pricing/pricing-modal-provider';

/** Button that opens the global pricing modal; styling arrives via className. */
export function PricingNavButton({
  className,
  label,
}: {
  className?: string;
  label: ReactNode;
}) {
  const { openPricing } = usePricingModal();

  return (
    <button type="button" className={className} onClick={openPricing}>
      {label}
    </button>
  );
}
