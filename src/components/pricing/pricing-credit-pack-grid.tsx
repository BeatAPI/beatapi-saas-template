
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Loader2Icon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoginWrapper } from '@/components/auth/login-wrapper';
import { Link, usePathname } from '@/core/i18n/navigation';
import { createZpayCreditCheckoutSessionFn } from '@/core/workspace-actions/create-zpay-credit-checkout-session';
import { getLocalizedRoute } from '@/core/workspace-lib/auth-redirect';
import { useCreditPackages } from '@/core/workspace-lib/credits-config';
import { formatPrice } from '@/core/workspace-lib/formatter';
import { useCurrentUser } from '@/core/workspace-hooks/use-current-user';
import { useLocale, useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { Routes } from '@/core/workspace-lib/shims/routes';
import type { CreditPackage } from '@/core/workspace-credits/types';
import { cn } from '@/lib/utils';

type CreditPaymentMethod = 'alipay' | 'wxpay';

const planCtaClassName =
  'group flex h-12! w-full shrink-0 items-center justify-center rounded-full bg-[#f3f3ef] p-1 text-base font-semibold text-[#151515] hover:bg-white';

type PricingCreditPackGridProps = {
  variant?: 'modal' | 'home';
  locale?: string;
  className?: string;
};

type FeatureItem = {
  text: string;
  status: 'included' | 'excluded';
};

type FreeCreditDisplayCard = {
  kind: 'free';
  id: string;
  name: string;
  amount: number;
  priceLabel: string;
  badgeLabel: string;
  ctaLabel: string;
  includesLabel: string;
  features: FeatureItem[];
};

type PaidCreditDisplayCard = {
  kind: 'paid';
  id: string;
  name: string;
  amount: number;
  priceLabel: string;
  originalPriceLabel?: string;
  badgeLabel: string;
  badgeTone: 'neutral' | 'popular' | 'bestPrice';
  ctaLabel: string;
  includesLabel: string;
  features: FeatureItem[];
  isRecommended: boolean;
  creditPackage: CreditPackage;
  topBanner?: {
    label: string;
    tone: 'popular' | 'bestPrice';
  };
};

type CreditDisplayCard = FreeCreditDisplayCard | PaidCreditDisplayCard;

const CREDIT_PACK_DISCOUNTS: Record<
  string,
  { originalPriceLabel: string; tone: 'popular' | 'bestPrice' }
> = {
  standard: {
    originalPriceLabel: '¥195',
    tone: 'popular',
  },
  premium: {
    originalPriceLabel: '¥780',
    tone: 'bestPrice',
  },
};

function toCnyDisplayLabel(label: string) {
  return label.replace(/^CN¥/, '¥');
}

function stripPricePrefix(label: string) {
  return label.replace(/^CN¥/, '').replace(/^¥/, '');
}

function formatZpayPriceLabel(creditPackage: CreditPackage) {
  return toCnyDisplayLabel(
    formatPrice(creditPackage.price.amount, creditPackage.price.currency)
  );
}

function getOriginalPriceLabel(packageId: string) {
  return CREDIT_PACK_DISCOUNTS[packageId]?.originalPriceLabel ?? '';
}

function getBadgeTone(packageId: string): PaidCreditDisplayCard['badgeTone'] {
  return CREDIT_PACK_DISCOUNTS[packageId]?.tone ?? 'neutral';
}

function getTopBanner(t: ReturnType<typeof useTranslations>, packageId: string) {
  if (packageId === 'standard') {
    return {
      label: t('topBanners.mostPopular'),
      tone: 'popular' as const,
    };
  }

  if (packageId === 'premium') {
    return {
      label: t('topBanners.bestPrice'),
      tone: 'bestPrice' as const,
    };
  }

  return undefined;
}

function FeatureList({ features }: { features: FeatureItem[] }) {
  return (
    <ul className="mb-4 mt-5 flex flex-col gap-2 text-[15px] text-white/72">
      {features.map((feature) => (
        <li
          key={`${feature.status}-${feature.text}`}
          className="flex items-start gap-2.5 leading-6"
        >
          {feature.status === 'included' ? (
            <CheckIcon
              className="mt-1 size-4 shrink-0 text-white/64"
              aria-hidden="true"
            />
          ) : (
            <XIcon
              className="mt-1 size-4 shrink-0 text-white/18"
              aria-hidden="true"
            />
          )}
          <span
            className={cn(feature.status === 'excluded' && 'text-white/24')}
          >
            {feature.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AlipayLogo() {
  return (
    <span className="flex size-9 items-center justify-center rounded-lg bg-[#1677FF] text-2xl font-black leading-none text-white">
      Al
    </span>
  );
}

function WeChatPayLogo() {
  return (
    <svg
      aria-hidden="true"
      className="size-10 text-[#07C160]"
      viewBox="0 0 48 48"
      fill="none"
    >
      <path
        d="M20.2 12C11.8 12 5 17.6 5 24.6c0 4 2.3 7.6 5.8 9.9l-1.1 4.1 5.1-2.3c1.6.5 3.4.8 5.4.8 8.4 0 15.2-5.6 15.2-12.5S28.6 12 20.2 12Z"
        fill="currentColor"
      />
      <path
        d="M30.4 22.5c-6.8 0-12.3 4.5-12.3 10.2 0 5.6 5.5 10.2 12.3 10.2 1.5 0 3-.2 4.3-.7l4.2 1.9-.9-3.4c2.9-1.8 4.7-4.7 4.7-8 0-5.7-5.5-10.2-12.3-10.2Z"
        fill="currentColor"
        opacity="0.82"
      />
      <circle cx="15.4" cy="22.2" r="1.7" fill="#101621" />
      <circle cx="24.5" cy="22.2" r="1.7" fill="#101621" />
      <circle cx="26.8" cy="31.8" r="1.3" fill="#101621" />
      <circle cx="34.1" cy="31.8" r="1.3" fill="#101621" />
    </svg>
  );
}

function CreditCheckoutButton({
  packageId,
  className,
  children,
}: {
  packageId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('Dashboard.settings.credits.packages');
  const paymentT = useTranslations('PricingPage.paymentChoice');
  const [open, setOpen] = useState(false);
  const [loadingMethod, setLoadingMethod] =
    useState<CreditPaymentMethod | null>(null);

  async function handlePaymentMethodClick(method: CreditPaymentMethod) {
    try {
      setLoadingMethod(method);
      const result = await createZpayCreditCheckoutSessionFn({
        data: { packageId, paymentMethod: method },
      });

      if (result?.success && result?.data?.url) {
        window.location.href = result.data.url;
        return;
      }

      console.error('Create ZPAY credit checkout session error:', result);
      toast.error(result?.error || t('checkoutFailed'));
    } catch (error) {
      console.error('Create credit checkout session error:', error);
      toast.error(t('checkoutFailed'));
    } finally {
      setLoadingMethod(null);
    }
  }

  const isLoading = loadingMethod !== null;
  const paymentOptions: Array<{
    method: CreditPaymentMethod;
    title: string;
    logo: React.ReactNode;
  }> = [
    {
      method: 'alipay',
      title: paymentT('alipayTitle'),
      logo: <AlipayLogo />,
    },
    {
      method: 'wxpay',
      title: paymentT('wechatTitle'),
      logo: <WeChatPayLogo />,
    },
  ];

  return (
    <>
      <Button
        type="button"
        className={className}
        disabled={isLoading}
        onClick={() => setOpen(true)}
      >
        {isLoading ? (
          <>
            <Loader2Icon className="mr-2 size-4 animate-spin" />
            {t('loading')}
          </>
        ) : (
          children
        )}
      </Button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4">
              <button
                type="button"
                aria-label={paymentT('closeLabel')}
                className="absolute inset-0 bg-black/72 backdrop-blur-[8px]"
                onClick={() => {
                  if (!isLoading) {
                    setOpen(false);
                  }
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="credit-payment-choice-title"
                aria-describedby="credit-payment-choice-description"
                className="relative z-10 w-full max-w-[30rem] rounded-[22px] border border-white/10 bg-[#151619] p-6 text-white shadow-[0_30px_100px_rgba(0,0,0,0.56)]"
              >
                <button
                  type="button"
                  aria-label={paymentT('closeLabel')}
                  disabled={isLoading}
                  onClick={() => setOpen(false)}
                  className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-white/38 transition hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-50"
                >
                  <XIcon className="size-4" />
                </button>
                <div className="pr-10">
                  <h2
                    id="credit-payment-choice-title"
                    className="text-lg font-semibold leading-none text-white"
                  >
                    {paymentT('title')}
                  </h2>
                  <p
                    id="credit-payment-choice-description"
                    className="mt-2 text-sm leading-6 text-white/48"
                  >
                    {paymentT('description')}
                  </p>
                </div>
                <div className="mt-5 grid gap-3">
                  {paymentOptions.map((option) => {
                    const optionIsLoading = loadingMethod === option.method;
                    return (
                      <button
                        key={option.method}
                        type="button"
                        onClick={() => handlePaymentMethodClick(option.method)}
                        disabled={isLoading}
                        className="flex min-h-[4.25rem] w-full items-center gap-4 rounded-xl border border-white/[0.09] bg-white/[0.045] px-5 py-3 text-left transition-colors hover:border-white/16 hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <span className="flex h-10 min-w-16 shrink-0 items-center justify-center">
                          {optionIsLoading ? (
                            <Loader2Icon className="size-5 animate-spin" />
                          ) : (
                            option.logo
                          )}
                        </span>
                        <span className="min-w-0 flex-1 text-lg font-semibold text-white">
                          {option.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function PricingCreditPackGrid({
  variant = 'modal',
  locale,
  className,
}: PricingCreditPackGridProps = {}) {
  const t = useTranslations('PricingPage.creditPacks');
  const carouselRef = useRef<HTMLDivElement>(null);
  const currentLocale = useLocale();
  const resolvedLocale = locale ?? currentLocale;
  const currentPath = usePathname();
  const currentUser = useCurrentUser();
  const packages = useCreditPackages();
  const createProjectHref = getLocalizedRoute(
    Routes.Canvas,
    resolvedLocale
  );
  const paidPackages = Object.values(packages)
    .filter(
      (creditPackage) => !creditPackage.disabled && creditPackage.price.priceId
    )
    .sort((a, b) => a.price.amount - b.price.amount)
    .slice(0, 3);

  const freePlan: FreeCreditDisplayCard = {
    kind: 'free',
    id: 'free',
    name: t('freePlan.name'),
    amount: 0,
    priceLabel: t('freePlan.price'),
    badgeLabel: t('freePlan.badge'),
    ctaLabel: t('freePlan.cta'),
    includesLabel: t('freePlan.includes'),
    features: [
      { text: t('freePlan.gptImage2OneK'), status: 'included' },
      { text: t('freePlan.projectHistory'), status: 'included' },
      { text: t('freePlan.limitedModels'), status: 'excluded' },
      { text: t('freePlan.limitedTemplates'), status: 'excluded' },
      { text: t('freePlan.limitedOutputQuality'), status: 'excluded' },
    ],
  };

  const paidCards: PaidCreditDisplayCard[] = paidPackages.map(
    (creditPackage, index) => {
      const displayName =
        [t('planStarter'), t('planCreator'), t('planPro')][index] ??
        t('planPro');

      return {
        kind: 'paid',
        id: creditPackage.id,
        name: displayName,
        amount: creditPackage.amount,
        priceLabel: formatZpayPriceLabel(creditPackage),
        originalPriceLabel: getOriginalPriceLabel(creditPackage.id),
        badgeLabel: t('oneTimePlanBadge'),
        badgeTone: getBadgeTone(creditPackage.id),
        ctaLabel: t('choosePlan', { name: displayName }),
        includesLabel: t('paidIncludes'),
        features: [
          { text: t('allTemplates'), status: 'included' },
          { text: t('allModels'), status: 'included' },
          { text: t('allOutputQualities'), status: 'included' },
          { text: t('noSubscription'), status: 'included' },
          { text: t('paymentMethods'), status: 'included' },
        ],
        isRecommended: Boolean(creditPackage.popular),
        creditPackage,
        topBanner: getTopBanner(t, creditPackage.id),
      };
    }
  );

  const cards: CreditDisplayCard[] = [freePlan, ...paidCards];

  function scrollCarousel(direction: -1 | 1) {
    carouselRef.current?.scrollBy({
      behavior: 'smooth',
      left: direction * Math.max(280, carouselRef.current.clientWidth * 0.82),
    });
  }

  return (
    <section
      id={variant === 'home' ? 'pricing' : undefined}
      className={cn(
        'relative isolate w-full text-[#f6f6f4]',
        variant === 'home'
          ? 'max-w-[100vw] overflow-hidden bg-transparent py-16 md:py-24'
          : 'overflow-visible rounded-[30px] bg-[#0d0e10] py-10',
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1548px]">
        <div className="mx-auto max-w-[1120px] px-5 text-center">
          <h2 className="text-[2rem] font-medium leading-[1.2] tracking-[-0.035em] text-[#f6f6f4] md:text-[3.25rem]">
            Simple pricing that scales with you
          </h2>
          <p className="mx-auto mt-6 max-w-[620px] text-lg leading-6 text-white/48">
            Choose the access level that fits your creative workflow
          </p>
        </div>

        <div className="mt-14 flex min-w-0 justify-center px-5">
          <div
            className="flex max-w-full items-center overflow-hidden rounded-full border border-white/[0.08] bg-[#17181b] p-1 shadow-[0_14px_40px_rgba(0,0,0,0.32)]"
            role="group"
            aria-label="Purchase type"
          >
            <button
              type="button"
              aria-pressed="true"
              className="shrink-0 rounded-full bg-[#f3f3ef] px-4 py-2 text-[13px] font-semibold text-[#151515] sm:px-5 sm:text-sm"
            >
              One-time plans
            </button>
            <button
              type="button"
              disabled
              aria-pressed="false"
              className="flex min-w-0 items-center rounded-full px-3 py-1.5 text-[13px] font-medium text-white/52 disabled:opacity-100 sm:px-4 sm:text-sm"
            >
              Subscription
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => scrollCarousel(-1)}
            aria-label="Previous plan"
            className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/68 shadow-[0_10px_34px_rgba(0,0,0,0.28)] backdrop-blur-lg transition hover:border-[#ff7a33]/50 hover:bg-[#ff7a33] hover:text-[#151515]"
          >
            <ArrowLeftIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollCarousel(1)}
            aria-label="Next plan"
            className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/68 shadow-[0_10px_34px_rgba(0,0,0,0.28)] backdrop-blur-lg transition hover:border-[#ff7a33]/50 hover:bg-[#ff7a33] hover:text-[#151515]"
          >
            <ArrowRightIcon className="size-5" />
          </button>
        </div>

        <div className="relative mx-auto mt-8 px-5 md:mt-16">
          <div
            ref={carouselRef}
            className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:items-stretch md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4 xl:gap-[26px] [&::-webkit-scrollbar]:hidden"
            data-beatapi-pricing-carousel=""
          >
          {cards.map((card) => {
            const topBanner = card.kind === 'paid' ? card.topBanner : undefined;
            const isPopular =
              card.kind === 'paid' && card.topBanner?.tone === 'popular';
            const isBestPrice =
              card.kind === 'paid' && card.topBanner?.tone === 'bestPrice';
            return (
              <div
                key={card.id}
                className="min-w-0 w-[calc(100vw-4.5rem)] shrink-0 snap-center md:contents"
              >
                <article className="relative flex h-full min-w-0 min-h-[720px] flex-col pt-9 transition-transform duration-300 hover:-translate-y-1">
                  <div
                    className={cn(
                      'absolute inset-x-0 top-0 flex h-16 items-start justify-center rounded-t-[30px] pt-2.5 text-center text-[11px] font-medium uppercase tracking-[0.12em] sm:text-[13px]',
                      isPopular
                        ? 'bg-[#ff7a33] text-[#160d08]'
                        : isBestPrice
                          ? 'bg-[#e7c35d] text-[#171309]'
                          : 'bg-[#25262a] text-white/55'
                    )}
                  >
                    {card.kind === 'free'
                      ? 'START FREE — NO CARD REQUIRED'
                      : topBanner?.label || 'ONE-TIME PLAN · NEVER AUTO-RENEWS'}
                  </div>

                  <div
                    className={cn(
                      'relative flex min-w-0 flex-1 flex-col gap-5 rounded-[38px] border border-white/[0.08] bg-[#141517] p-6 pt-10 text-[#f6f6f4] shadow-[0_24px_72px_rgba(0,0,0,0.34)]',
                      isPopular && 'border-[#ff7a33]/65 ring-1 ring-[#ff7a33]/55',
                      isBestPrice && 'border-[#e7c35d]/35'
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-[0.667em]">
                      <h3 className="text-[2em] font-semibold leading-[1.333] tracking-tight md:text-[2.5em] md:leading-[1.2]">
                        {card.name}
                      </h3>
                      <span className="inline-flex rounded-[0.667em] border border-white/[0.08] bg-white/[0.07] px-[1.333em] py-[0.333em] text-[0.72em]/[1.333] font-bold tracking-wider text-white/72">
                        {card.badgeLabel}
                      </span>
                    </div>

                    <p className="-mt-3 text-[13px] leading-5 text-white/44">
                      {card.kind === 'free'
                        ? 'For creators testing their first visual ideas'
                        : isPopular
                          ? 'For creators building AI projects consistently'
                          : isBestPrice
                            ? 'For teams producing visual content at scale'
                            : 'For creators exploring AI tools and workflows'}
                    </p>

                    <div className="flex items-end gap-1.5">
                      {card.kind === 'paid' && card.originalPriceLabel ? (
                        <span className="text-xl font-medium text-white/24 line-through md:text-2xl">
                          {card.originalPriceLabel}
                        </span>
                      ) : null}
                      <span className="whitespace-nowrap text-4xl font-semibold leading-none tracking-tight md:text-[2.875rem]">
                        ¥{stripPricePrefix(card.priceLabel)}
                      </span>
                      <span className="mb-1 text-sm font-bold">/one-time</span>
                    </div>

                    <div
                      className={cn(
                        'mt-2 flex h-[260px] shrink-0 flex-col rounded-3xl p-px shadow-[0_8px_24px_rgba(22,25,31,0.08)]',
                        isPopular
                          ? 'bg-[#ff9a60] text-[#160d08]'
                          : isBestPrice
                            ? 'bg-[#e7c35d] text-[#171309]'
                            : 'bg-[#2a2b2f] text-white/62'
                      )}
                    >
                      <div className="px-3 py-2 text-center text-xs/[17px] font-bold uppercase tracking-wider">
                        {card.includesLabel}
                      </div>
                      <div className="flex flex-1 flex-col items-center justify-center rounded-[23px] border border-white/[0.06] bg-[#0c0d0f] px-4 py-5 text-center text-[#f6f6f4]">
                        <p className="text-lg font-semibold">
                          {t('creationAccessTitle')}
                        </p>
                        <div className="mt-1 flex flex-col gap-0.5 text-xs leading-5 text-white/42">
                          <p>{t('creationAccessDescription')}</p>
                          <p>{t('noAutoRenewal')}</p>
                        </div>
                      </div>
                    </div>

                    {card.kind === 'free' ? (
                      currentUser ? (
                        <Link
                          href={createProjectHref}
                          className={planCtaClassName}
                        >
                          <BeatApiButtonContent label={card.ctaLabel} />
                        </Link>
                      ) : (
                        <LoginWrapper
                          mode="modal"
                          asChild
                          callbackUrl={createProjectHref}
                        >
                          <Button className={planCtaClassName}>
                            <BeatApiButtonContent label={card.ctaLabel} />
                          </Button>
                        </LoginWrapper>
                      )
                    ) : currentUser ? (
                      <CreditCheckoutButton
                        packageId={card.creditPackage.id}
                        className={planCtaClassName}
                      >
                        <BeatApiButtonContent
                          accent={isPopular || isBestPrice}
                          label={card.ctaLabel}
                        />
                      </CreditCheckoutButton>
                    ) : (
                      <LoginWrapper
                        mode="modal"
                        asChild
                        callbackUrl={currentPath}
                      >
                        <Button className={planCtaClassName}>
                          <BeatApiButtonContent
                            accent={isPopular || isBestPrice}
                            label={card.ctaLabel}
                          />
                        </Button>
                      </LoginWrapper>
                    )}
                    <FeatureList features={card.features} />

                    <div className="mt-auto flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.025] px-4 py-4 text-white/70 sm:flex-row sm:justify-between sm:gap-2">
                      <span className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
                        <SparklesIcon className="size-4 text-[#ff6b1a]" />
                        BeatAPI models
                      </span>
                      <span className="whitespace-nowrap rounded-lg border border-white/[0.08] bg-white/[0.07] px-2.5 py-1 text-xs font-bold tracking-wider text-white/68">
                        {card.kind === 'free' ? 'SELECTED ACCESS' : 'FULL ACCESS'}
                      </span>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </section>
  );
}

function BeatApiButtonContent({
  accent = false,
  label,
}: {
  accent?: boolean;
  label: string;
}) {
  return (
    <span className="flex w-full grow items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-10 w-14 shrink-0 items-center justify-center rounded-full transition-transform duration-700 ease-in-out group-hover:translate-x-1.5',
          accent
            ? 'bg-[#ff7a33] text-[#151515]'
            : 'bg-[#222327] text-white'
        )}
      >
        <PixelArrowIcon />
      </span>
      <span className="grow pr-[66px] text-center">{label}</span>
    </span>
  );
}

function PixelArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-6"
      aria-hidden="true"
    >
      <path d="M8 5h2v2H8V5Zm3 3h2v2h-2V8Zm3 3h2v2h-2v-2Zm-3 3h2v2h-2v-2Zm-3 3h2v2H8v-2Z" fill="currentColor" />
    </svg>
  );
}
