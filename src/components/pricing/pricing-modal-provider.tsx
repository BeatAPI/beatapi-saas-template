
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

import { getLocale } from '@/paraglide/runtime.js';

type PricingModalComponent = ComponentType<{
  open: boolean;
  onClose: () => void;
  locale: string;
}>;

type PricingModalContextValue = {
  openPricing: () => void;
  closePricing: () => void;
};

const PricingModalContext = createContext<PricingModalContextValue | null>(
  null
);

function syncPricingSearchParam(open: boolean) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (open) {
    url.searchParams.set('pricing', '1');
  } else {
    url.searchParams.delete('pricing');
  }
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`
  );
}

export function PricingModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [Modal, setModal] = useState<PricingModalComponent | null>(null);

  const loadModal = useCallback(async () => {
    const mod = await import('../home/pricing-modal-impl');
    setModal(() => mod.PricingModal);
  }, []);

  const openPricing = useCallback(() => {
    syncPricingSearchParam(true);
    setOpen(true);
    if (!Modal) void loadModal();
  }, [Modal, loadModal]);

  const closePricing = useCallback(() => {
    setOpen(false);
    syncPricingSearchParam(false);
  }, []);

  useEffect(() => {
    if (new URL(window.location.href).searchParams.get('pricing') !== '1') {
      return;
    }
    setOpen(true);
    void loadModal();
  }, [loadModal]);

  const value = useMemo(
    () => ({ openPricing, closePricing }),
    [closePricing, openPricing]
  );

  return (
    <PricingModalContext.Provider value={value}>
      {children}
      {Modal ? (
        <Modal open={open} onClose={closePricing} locale={getLocale()} />
      ) : null}
    </PricingModalContext.Provider>
  );
}

export function usePricingModal() {
  const context = useContext(PricingModalContext);
  if (!context) {
    throw new Error('usePricingModal must be used within PricingModalProvider');
  }
  return context;
}
