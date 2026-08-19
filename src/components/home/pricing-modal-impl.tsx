
import { PricingCreditPackGrid } from '@/components/pricing/pricing-credit-pack-grid';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function PricingModal({
  open,
  onClose,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  locale: string;
}) {
  const t = useTranslations('BeatAPI.home');
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
      previousActiveElementRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-2 md:p-4">
      <div
        className="absolute inset-0 bg-black/76 backdrop-blur-[12px]"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('pricingModalTitle')}
        tabIndex={-1}
        className="relative z-10 flex h-[calc(100svh-1rem)] w-full max-w-[1460px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#08090a] text-white shadow-[0_45px_140px_rgba(0,0,0,0.68)] md:h-[calc(100svh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('pricingModalCloseLabel')}
          className="absolute right-3.5 top-3.5 z-20 inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/48 shadow-none backdrop-blur-md transition hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b1a]/55"
        >
          <X className="size-4" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-7">
          <PricingCreditPackGrid variant="modal" locale={locale} />
        </div>
      </div>
    </div>,
    document.body
  );
}
