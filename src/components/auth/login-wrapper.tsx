
import { signIn, signUp } from '@/core/auth/client';
import {
  AUTH_PASSWORD_MIN_LENGTH,
  classifyEmailSignInError,
  completeEmailAuthHandoff,
  getSafeAuthCallback,
  VerificationEmailDeliveryError,
} from '@/core/auth/registration-flow';
import { Link, usePathname, useRouter } from '@/core/i18n/navigation';
import { Routes } from '@/core/workspace-lib/shims/routes';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { localizeHref } from '@/paraglide/runtime.js';
import { MailIcon, XIcon } from 'lucide-react';
import {
  type ChangeEvent,
  cloneElement,
  type FormEvent,
  isValidElement,
  type MouseEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { usePublicConfig } from '@/hooks/use-public-config';
import { apiPost } from '@/lib/api-client';

const SHOWCASE_ASSETS = [
  {
    src: '/starter/product-workflow.svg',
    altKey: 'showcaseTeaAlt',
  },
  {
    src: '/starter/creator-workflow.svg',
    altKey: 'showcaseChocolateAlt',
  },
  {
    src: '/starter/video-workflow.svg',
    altKey: 'showcaseCoffeeAlt',
  },
] as const;

function AuthShowcasePanel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const t = useTranslations('BeatAPI.auth');

  useEffect(() => {
    const rotationTimer = window.setInterval(() => {
      setActiveIndex(
        (currentIndex) => (currentIndex + 1) % SHOWCASE_ASSETS.length
      );
    }, 4200);

    return () => window.clearInterval(rotationTimer);
  }, []);

  return (
    <aside className="relative hidden min-h-[600px] overflow-hidden bg-slate-950 lg:block">
      {SHOWCASE_ASSETS.map((asset, index) => (
        <img
          key={asset.src}
          src={asset.src}
          alt={index === activeIndex ? t(asset.altKey) : ''}
          aria-hidden={index !== activeIndex}
          className={[
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out',
            index === activeIndex ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.02)_58%,rgba(15,23,42,0.34)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 z-10 px-7 pb-7">
        <div className="grid grid-cols-3 gap-2.5">
          {SHOWCASE_ASSETS.map((asset, index) => (
            <button
              key={asset.src}
              type="button"
              className="group min-w-0"
              aria-label={t('showcaseImageLabel', { index: index + 1 })}
              aria-current={index === activeIndex}
              onClick={() => setActiveIndex(index)}
            >
              <span className="block h-1 overflow-hidden rounded-full bg-white/28">
                <span
                  className={[
                    'block h-full rounded-full bg-white transition-transform duration-700 ease-out',
                    index === activeIndex ? 'scale-x-100' : 'scale-x-0',
                  ].join(' ')}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function AuthModal({
  open,
  onOpenChange,
  callbackUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callbackUrl?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [emailOpen, setEmailOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const t = useTranslations('BeatAPI.auth');
  const nextUrl = getSafeAuthCallback(callbackUrl);
  const configQuery = usePublicConfig();
  const emailVerificationEnabled =
    configQuery.data?.email_verification_enabled !== 'false';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setError('');
    } else {
      setEmailOpen(false);
      setMode('login');
    }
  }, [open]);

  const canSubmit =
    !configQuery.isLoading &&
    form.email.trim() &&
    form.password &&
    (mode === 'login' ||
      (form.name.trim() &&
        form.password.length >= AUTH_PASSWORD_MIN_LENGTH &&
        form.password === form.confirmPassword));

  const handleChange =
    (key: keyof typeof form) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
    };

  async function handleGoogle() {
    setError('');
    setPending(true);
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: localizeHref(nextUrl),
      });
    } catch (err: any) {
      setError(err?.message || t('genericError'));
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    if (
      mode === 'register' &&
      form.password.length < AUTH_PASSWORD_MIN_LENGTH
    ) {
      setError(t('passwordMinLength'));
      return;
    }

    setPending(true);
    try {
      const result: any =
        mode === 'login'
          ? await signIn.email({
              email: form.email,
              password: form.password,
            })
          : await signUp.email({
              name: form.name,
              email: form.email,
              password: form.password,
            });

      if (result?.error) {
        const errorKind = classifyEmailSignInError(result.error);
        if (
          mode === 'login' &&
          errorKind === 'unverified' &&
          emailVerificationEnabled
        ) {
          const destination = await completeEmailAuthHandoff({
            email: form.email,
            afterLoginUrl: nextUrl,
            emailVerificationEnabled: true,
            localizeCallbackUrl: localizeHref,
            sendVerificationEmail: (params) =>
              apiPost('/api/auth/verification-email', params),
          });
          window.location.href = localizeHref(destination);
          return;
        }
        setError(
          errorKind === 'credentials'
            ? t('invalidCredentials')
            : t('genericError')
        );
        setPending(false);
        return;
      }

      const destination =
        mode === 'register'
          ? await completeEmailAuthHandoff({
              email: form.email,
              afterLoginUrl: nextUrl,
              emailVerificationEnabled,
              localizeCallbackUrl: localizeHref,
              sendVerificationEmail: (params) =>
                apiPost('/api/auth/verification-email', params),
            })
          : nextUrl;
      window.location.href = localizeHref(destination);
    } catch (err: any) {
      setError(
        err instanceof VerificationEmailDeliveryError
          ? t('verificationSendFailed')
          : err?.message || t('genericError')
      );
      setPending(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t('close')}
        className="absolute inset-0 bg-[rgba(15,15,15,0.56)] backdrop-blur-[6px]"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 grid w-full max-w-[897px] overflow-hidden rounded-[26px] border border-white/70 bg-white/94 shadow-[0_24px_76px_rgba(15,23,42,0.12)] lg:grid-cols-[minmax(0,420px)_minmax(0,475px)]">
        <button
          type="button"
          aria-label={t('close')}
          onClick={() => onOpenChange(false)}
          className="absolute right-3.5 top-3.5 z-20 inline-flex size-9 items-center justify-center rounded-full border border-white/18 bg-slate-950/20 text-white/90 shadow-none backdrop-blur-md transition hover:bg-slate-950/34 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
        >
          <XIcon className="size-4" />
        </button>

        <div className="relative flex min-h-[600px] flex-col justify-between bg-[linear-gradient(180deg,#ffffff_0%,#f7f9fc_100%)] px-6 py-6 text-slate-900 sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.08),transparent_34%),radial-gradient(circle_at_90%_18%,rgba(59,130,246,0.07),transparent_32%)]" />
          <div className="relative z-10 my-auto space-y-4">
            <div className="space-y-3 text-center">
              <Link
                href={Routes.Root}
                className="mx-auto inline-flex flex-col items-center gap-3 text-slate-900"
              >
                <span className="inline-flex items-center gap-2.5 text-xl font-semibold tracking-[-0.03em]">
                  <span className="grid size-9 place-items-center rounded-[9px] bg-[#ff6b1a] text-base font-bold text-white">B</span>
                  BeatAPI
                </span>
              </Link>
              <p className="text-[17px] font-semibold leading-6 tracking-[0.005em] text-slate-700">
                {t('modalTitle')}
              </p>
            </div>

            {mode === 'login' && !emailOpen ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={pending}
                  className="relative mx-auto flex h-[54px] w-full max-w-[326px] items-center justify-center rounded-[14px] border border-[#E3E9F4] bg-white px-5 text-center text-[16px] font-semibold text-[#1D1D1F] shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition hover:border-[#D3DDEC] disabled:opacity-60"
                >
                  <span className="absolute left-5 text-[24px] font-semibold">
                    G
                  </span>
                  <span>{t('continueGoogle')}</span>
                </button>
                <button
                  type="button"
                  aria-expanded={emailOpen}
                  className="relative mx-auto flex h-[54px] w-full max-w-[326px] items-center justify-center rounded-[14px] border border-[#E3E9F4] bg-white px-5 text-center text-[16px] font-semibold text-[#1D1D1F] shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition hover:border-[#D3DDEC]"
                  onClick={() => setEmailOpen(true)}
                >
                  <MailIcon className="absolute left-5 size-5 text-[#4568B2]" />
                  <span>{t('continueEmail')}</span>
                </button>
              </div>
            ) : (
              <form method="post" className="space-y-4" onSubmit={handleSubmit}>
                {mode === 'register' ? (
                  <label className="block space-y-1.5 text-[13px] font-semibold text-slate-700">
                    <span>{t('name')}</span>
                    <input
                      value={form.name}
                      onChange={handleChange('name')}
                      placeholder={t('namePlaceholder')}
                      className="h-11 w-full rounded-xl border border-[#E6ECF7] bg-white px-4 text-sm text-[#1D1D1F] shadow-[0_12px_26px_rgba(15,23,42,0.055)] outline-none placeholder:text-[#A0AEC0] focus:border-[#D5DFF2] focus:ring-4 focus:ring-[#E7EEF9]/90"
                    />
                  </label>
                ) : null}
                <label className="block space-y-1.5 text-[13px] font-semibold text-slate-700">
                  <span>{t('email')}</span>
                  <input
                    value={form.email}
                    onChange={handleChange('email')}
                    placeholder={t('emailPlaceholder')}
                    type="email"
                    autoComplete="email"
                    required
                    className="h-11 w-full rounded-xl border border-[#E6ECF7] bg-white px-4 text-sm text-[#1D1D1F] shadow-[0_12px_26px_rgba(15,23,42,0.055)] outline-none placeholder:text-[#A0AEC0] focus:border-[#D5DFF2] focus:ring-4 focus:ring-[#E7EEF9]/90"
                  />
                </label>
                <label className="block space-y-1.5 text-[13px] font-semibold text-slate-700">
                  <span>{t('passwordLabel')}</span>
                  <input
                    value={form.password}
                    onChange={handleChange('password')}
                    placeholder={t('passwordPlaceholder')}
                    type="password"
                    minLength={
                      mode === 'register' ? AUTH_PASSWORD_MIN_LENGTH : undefined
                    }
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                    required
                    className="h-11 w-full rounded-xl border border-[#E6ECF7] bg-white px-4 text-sm text-[#1D1D1F] shadow-[0_12px_26px_rgba(15,23,42,0.055)] outline-none placeholder:text-[#A0AEC0] focus:border-[#D5DFF2] focus:ring-4 focus:ring-[#E7EEF9]/90"
                  />
                  {mode === 'register' ? (
                    <span className="block text-xs font-normal text-slate-500">
                      {t('passwordMinLength')}
                    </span>
                  ) : null}
                </label>
                {mode === 'register' ? (
                  <label className="block space-y-1.5 text-[13px] font-semibold text-slate-700">
                    <span>{t('confirmPassword')}</span>
                    <input
                      value={form.confirmPassword}
                      onChange={handleChange('confirmPassword')}
                      placeholder={t('passwordPlaceholder')}
                      type="password"
                      minLength={AUTH_PASSWORD_MIN_LENGTH}
                      autoComplete="new-password"
                      required
                      className="h-11 w-full rounded-xl border border-[#E6ECF7] bg-white px-4 text-sm text-[#1D1D1F] shadow-[0_12px_26px_rgba(15,23,42,0.055)] outline-none placeholder:text-[#A0AEC0] focus:border-[#D5DFF2] focus:ring-4 focus:ring-[#E7EEF9]/90"
                    />
                  </label>
                ) : null}
                {error ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={pending || !canSubmit}
                  className="h-11 w-full rounded-xl bg-[#1D1D1F] text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? '...' : mode === 'login' ? t('login') : t('register')}
                </button>
              </form>
            )}

            <div className="text-center text-sm text-slate-500">
              {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
              <button
                type="button"
                className="text-slate-700 underline underline-offset-4"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setEmailOpen(true);
                  setError('');
                }}
              >
                {mode === 'login' ? t('register') : t('login')}
              </button>
            </div>
          </div>

          <p className="relative z-10 text-center text-[12px] leading-5 text-slate-500">
            {t('termsPrefix')}
            <br />
            <Link href={Routes.TermsOfService} className="underline">
              {t('terms')}
            </Link>{' '}
            {t('termsJoiner')}{' '}
            <Link href={Routes.PrivacyPolicy} className="underline">
              {t('privacy')}
            </Link>
          </p>
        </div>

        <AuthShowcasePanel />
      </div>
    </div>,
    document.body
  );
}

interface LoginWrapperProps {
  children: React.ReactNode;
  mode?: 'modal' | 'redirect';
  asChild?: boolean;
  callbackUrl?: string;
}

export function LoginWrapper({
  children,
  mode = 'redirect',
  asChild,
  callbackUrl,
}: LoginWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const currentPath = useMemo(() => pathname || '/', [pathname]);
  const effectiveCallbackUrl = callbackUrl ?? currentPath;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleLogin = () => {
    if (mode === 'modal') {
      setOpen(true);
      return;
    }
    router.push(
      `${Routes.SIGN_IN}?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`
    );
  };

  const trigger = (() => {
    if (asChild && isValidElement(children)) {
      const childElement = children as React.ReactElement<{
        onClick?: (event: MouseEvent<HTMLElement>) => void;
      }>;

      return cloneElement(childElement, {
        onClick: (event: MouseEvent<HTMLElement>) => {
          childElement.props.onClick?.(event);
          if (!event.defaultPrevented) {
            handleLogin();
          }
        },
      });
    }

    return (
      <span onClick={handleLogin} className="cursor-pointer">
        {children}
      </span>
    );
  })();

  return (
    <>
      {trigger}
      {mode === 'modal' ? (
        <AuthModal
          open={open}
          onOpenChange={setOpen}
          callbackUrl={effectiveCallbackUrl}
        />
      ) : null}
    </>
  );
}
