import { PricingCreditPackGrid } from "@/components/pricing/pricing-credit-pack-grid";
import { useLocale } from "@/core/workspace-lib/shims/next-intl";
import { cn } from "@/lib/utils";

export function Pricing({
  className,
}: {
  title?: string;
  className?: string;
} = {}) {
  const locale = useLocale();

  return (
    <PricingCreditPackGrid
      variant="home"
      locale={locale}
      className={cn("border-t border-black/[0.06]", className)}
    />
  );
}
