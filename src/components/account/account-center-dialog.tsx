
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import {
  BanknoteIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinsIcon,
  CreditCardIcon,
  GemIcon,
  GiftIcon,
  HandCoinsIcon,
  Loader2Icon,
  LogOutIcon,
  MailIcon,
  PencilLineIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  User2Icon,
  UserRoundIcon,
  WalletCardsIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePricingModal } from '@/components/pricing/pricing-modal-provider';
import { apiPatch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { validateAvatarFile } from '@/core/effects/validation';
import { useLocaleRouter } from '@/core/i18n/navigation';
import { CREDIT_TRANSACTION_TYPE, type CreditTransaction } from '@/core/workspace-credits/types';
import { useHasCredentialProvider } from '@/core/workspace-hooks/use-auth';
import { useCreditBalance, useCreditTransactions } from '@/core/workspace-hooks/use-credits';
import { invalidateWorkspaceAfterAuthChange } from '@/core/workspace-lib/app/workspace-query-invalidation';
import { authClient } from '@/core/workspace-lib/auth-client';
import { AUTH_PASSWORD_MIN_LENGTH } from '@/core/auth/registration-flow';
import { formatCreditTransactionDateTime } from '@/core/workspace-lib/credit-transaction-display';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { websiteConfig } from '@/core/workspace-lib/website';
import { uploadFileFromBrowser } from '@/core/workspace-storage/client';

export type AccountCenterSection =
  | 'profile'
  | 'credits'
  | 'transactions';

function makeAccountCenterCopy(t: ReturnType<typeof useTranslations>) {
  return {
    title: t('title'),
    loading: t('loading'),
    sections: {
      profile: t('sections.profile'),
      credits: t('sections.credits'),
      transactions: t('sections.transactions'),
    },
    profile: {
      title: t('profile.title'),
      avatar: t('profile.avatar'),
      userName: t('profile.userName'),
      email: t('profile.email'),
      editName: t('profile.editName'),
      namePlaceholder: t('profile.namePlaceholder'),
      cancel: t('profile.cancel'),
      save: t('profile.save'),
      saving: t('profile.saving'),
      security: t('profile.security'),
      changePassword: t('profile.changePassword'),
      setupPassword: t('profile.setupPassword'),
      currentPassword: t('profile.currentPassword'),
      newPassword: t('profile.newPassword'),
      passwordHint: t('profile.passwordHint'),
      passwordSaving: t('profile.passwordSaving'),
      signOut: t('profile.signOut'),
      signedInAs: t('profile.signedInAs'),
    },
    credits: {
      title: t('credits.title'),
      description: t('credits.description'),
      balance: t('credits.balance'),
      balanceUnavailable: t('credits.balanceUnavailable'),
      buy: t('credits.buy'),
      viewHistory: t('credits.viewHistory'),
      note: t('credits.note'),
    },
    transactions: {
      title: t('transactions.title'),
      description: t('transactions.description'),
      search: t('transactions.search'),
      all: t('transactions.all'),
      previous: t('transactions.previous'),
      next: t('transactions.next'),
      empty: t('transactions.empty'),
      amount: t('transactions.amount'),
      remaining: t('transactions.remaining'),
      model: t('transactions.model'),
      time: t('transactions.time'),
      page: t('transactions.page'),
      types: {
        MONTHLY_REFRESH: t('transactions.types.MONTHLY_REFRESH'),
        REGISTER_GIFT: t('transactions.types.REGISTER_GIFT'),
        PURCHASE_PACKAGE: t('transactions.types.PURCHASE_PACKAGE'),
        SUBSCRIPTION_RENEWAL: t('transactions.types.SUBSCRIPTION_RENEWAL'),
        SUBSCRIPTION_PLAN_CHANGE: t('transactions.types.SUBSCRIPTION_PLAN_CHANGE'),
        LIFETIME_MONTHLY: t('transactions.types.LIFETIME_MONTHLY'),
        REFUND: t('transactions.types.REFUND'),
        RESERVE: t('transactions.types.RESERVE'),
        RELEASE: t('transactions.types.RELEASE'),
        USAGE: t('transactions.types.USAGE'),
        EXPIRE: t('transactions.types.EXPIRE'),
      },
      status: {
        succeeded: t('transactions.status.succeeded'),
        failed: t('transactions.status.failed'),
        processing: t('transactions.status.processing'),
      },
    },
    close: t('close'),
    avatarUploadFailed: t('avatarUploadFailed'),
    avatarUploading: t('avatarUploading'),
    nameSuccess: t('nameSuccess'),
    nameFail: t('nameFail'),
    nameLength: t('nameLength'),
    passwordSuccess: t('passwordSuccess'),
    passwordFail: t('passwordFail'),
    currentPasswordRequired: t('currentPasswordRequired'),
    newPasswordMinLength: t('newPasswordMinLength'),
  };
}

type AccountCenterCopy = ReturnType<typeof makeAccountCenterCopy>;
type TransactionCopy = AccountCenterCopy['transactions'];

const SECTION_ICON_MAP = {
  profile: UserRoundIcon,
  credits: WalletCardsIcon,
  transactions: CreditCardIcon,
} as const;

const ACCOUNT_PANEL_CLASS =
  'rounded-2xl border border-[#E8E8ED] bg-white px-6 py-5';

const ACCOUNT_PRIMARY_BUTTON_CLASS =
  'h-10 rounded-xl bg-[#1D1D1F] px-5 text-[14px] font-medium text-white shadow-none transition hover:bg-[#333]';

const ACCOUNT_SECONDARY_BUTTON_CLASS =
  'h-10 rounded-xl border border-[#E8E8ED] bg-white px-4 text-[14px] font-medium text-[#555] shadow-none transition hover:border-[#D0D0D5] hover:bg-[#FAFAFA] hover:text-[#1D1D1F]';

const ACCOUNT_SOFT_ICON_BUTTON_CLASS =
  'h-9 rounded-xl border border-[#E8E8ED] bg-white px-3 text-[#888] shadow-none transition hover:border-[#D0D0D5] hover:bg-[#FAFAFA] hover:text-[#1D1D1F]';

const ACCOUNT_EYEBROW_TEXT_CLASS =
  'text-[11px] font-medium uppercase tracking-[0.16em] text-[#999]';

const ACCOUNT_VALUE_TEXT_CLASS =
  'text-[18px] font-semibold tracking-[-0.03em] text-[#1D1D1F]';

const ACCOUNT_LABEL_TEXT_CLASS = 'text-[13px] font-medium text-[#888]';

const ACCOUNT_BODY_TEXT_CLASS = 'text-[14px] leading-6 text-[#333]';

const ACCOUNT_MUTED_TEXT_CLASS = 'text-[13px] leading-6 text-[#999]';

function AccountSectionButton({
  section,
  label,
  active,
  onSelect,
}: {
  section: AccountCenterSection;
  label: string;
  active: boolean;
  onSelect: (section: AccountCenterSection) => void;
}) {
  const Icon = SECTION_ICON_MAP[section];

  return (
    <button
      type="button"
      onClick={() => onSelect(section)}
      className={cn(
        'flex w-full items-center gap-3 rounded-[18px] px-4 py-3.5 text-left text-[15px] font-medium transition',
        active
          ? 'bg-[#E8E8EC] text-[#1D1D1F]'
          : 'text-[#999] hover:bg-[#EEEEF2] hover:text-[#1D1D1F]'
      )}
    >
      <Icon
        className={cn(
          'size-5 shrink-0 transition',
          active ? 'text-[#1D1D1F]' : 'text-[#999]'
        )}
      />
      <span>{label}</span>
    </button>
  );
}

function AccountSectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1 border-b border-[#E8E8ED] pb-6">
      <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-[#1D1D1F]">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-[14px] leading-6 text-[#999]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function TransactionTypeIcon({ type }: { type: string }) {
  const iconClassName = 'size-4';

  switch (type) {
    case CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH:
      return <HandCoinsIcon className={iconClassName} />;
    case CREDIT_TRANSACTION_TYPE.REGISTER_GIFT:
      return <GiftIcon className={iconClassName} />;
    case CREDIT_TRANSACTION_TYPE.PURCHASE_PACKAGE:
      return <ShoppingCartIcon className={iconClassName} />;
    case CREDIT_TRANSACTION_TYPE.USAGE:
      return <CoinsIcon className={iconClassName} />;
    case CREDIT_TRANSACTION_TYPE.EXPIRE:
      return <ClockIcon className={iconClassName} />;
    case CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_RENEWAL:
    case CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_PLAN_CHANGE:
      return <BanknoteIcon className={iconClassName} />;
    case CREDIT_TRANSACTION_TYPE.LIFETIME_MONTHLY:
      return <GemIcon className={iconClassName} />;
    default:
      return <CoinsIcon className={iconClassName} />;
  }
}

function getTransactionStatusLabel(status: string | null | undefined, copy: TransactionCopy) {
  if (!status) return null;
  if (status === 'succeeded') return copy.status.succeeded;
  if (status === 'failed') return copy.status.failed;
  if (status === 'processing' || status === 'pending') {
    return copy.status.processing;
  }
  return status;
}

function getTransactionStatusClassName(status: string | null | undefined) {
  if (status === 'succeeded') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'failed') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function TransactionRow({
  transaction,
  copy,
}: {
  transaction: CreditTransaction;
  copy: TransactionCopy;
}) {
  const typeLabel =
    copy.types[transaction.type as keyof typeof copy.types] ?? transaction.type;
  const statusLabel = getTransactionStatusLabel(transaction.generationStatus, copy);
  const amount = transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount;
  const createdAt =
    transaction.createdAt instanceof Date
      ? transaction.createdAt
      : new Date(transaction.createdAt);

  return (
    <div className="grid gap-3 border-b border-[#EEF1F6] py-4 last:border-b-0 lg:grid-cols-[minmax(160px,220px)_minmax(220px,1fr)_120px_150px] lg:items-center">
      <div className="min-w-0 space-y-2">
        <Badge
          variant="outline"
          className="h-7 gap-1.5 border-[#DCE6F8] bg-[#F7FAFF] px-2.5 text-[#4568B2]"
        >
          <TransactionTypeIcon type={transaction.type} />
          {typeLabel}
        </Badge>
        {statusLabel ? (
          <Badge
            variant="outline"
            className={cn('ml-2 h-7 px-2.5', getTransactionStatusClassName(transaction.generationStatus))}
          >
            {statusLabel}
          </Badge>
        ) : null}
      </div>

      <div className="min-w-0 space-y-1">
        <p className="truncate text-[14px] font-medium text-[#333]">
          {transaction.description || transaction.referenceId || '-'}
        </p>
        {transaction.modelParams ? (
          <p className="line-clamp-2 text-[13px] leading-5 text-[#66738A]">
            {transaction.modelParams}
          </p>
        ) : null}
      </div>

      <div className="space-y-1 lg:text-right">
        <p
          className={cn(
            'text-[16px] font-semibold tabular-nums',
            transaction.amount >= 0 ? 'text-[#2563EB]' : 'text-[#1D1D1F]'
          )}
        >
          {amount}
        </p>
        {transaction.remainingAmount != null ? (
          <p className="text-[12px] text-[#999]">
            {copy.remaining}: {transaction.remainingAmount}
          </p>
        ) : null}
      </div>

      <p className="text-[13px] text-[#667085] lg:text-right">
        {Number.isNaN(createdAt.getTime())
          ? '-'
          : formatCreditTransactionDateTime(createdAt)}
      </p>
    </div>
  );
}

function ProfileSection({ onClose }: { onClose: () => void }) {
  const copy = makeAccountCenterCopy(useTranslations('BeatAPI.account'));
  const router = useLocaleRouter();
  const queryClient = useQueryClient();
  const { data: session, refetch } = authClient.useSession();
  const { hasCredentialProvider, isLoading: isLoadingAccounts } =
    useHasCredentialProvider(session?.user?.id);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [nameError, setNameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showPasswordEditor, setShowPasswordEditor] = useState(false);
  const canUpdateAvatar =
    websiteConfig.storage.enable && websiteConfig.features.enableUpdateAvatar;

  const updateProfile = useMutation({
    mutationFn: (data: { name?: string; image?: string | null }) =>
      apiPatch('/api/user/profile', data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-info'] });
      await refetch();
    },
  });

  useEffect(() => {
    setDraftName(session?.user?.name ?? '');
    setAvatarUrl(session?.user?.image ?? '');
  }, [session?.user?.image, session?.user?.name]);

  if (!session?.user) {
    return null;
  }

  const handleAvatarUpload = async (file: File) => {
    setIsUploadingAvatar(true);
    setNameError('');

    const validation = validateAvatarFile(file);
    if (!validation.ok) {
      toast.error(copy.avatarUploadFailed);
      setIsUploadingAvatar(false);
      return;
    }

    const tempUrl = URL.createObjectURL(file);
    const previousUrl = avatarUrl;
    setAvatarUrl(tempUrl);

    try {
      const { url } = await uploadFileFromBrowser(file, 'avatars');
      await updateProfile.mutateAsync({ image: url });
      setAvatarUrl(url);
    } catch (error) {
      console.error('update avatar error:', error);
      setAvatarUrl(previousUrl);
      toast.error(copy.avatarUploadFailed);
    } finally {
      URL.revokeObjectURL(tempUrl);
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarButtonClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        void handleAvatarUpload(file);
      }
    };
    input.click();
  };

  const handleSaveName = async () => {
    const nextName = draftName.trim();
    if (nextName.length < 3 || nextName.length > 30) {
      setNameError(copy.nameLength);
      return;
    }

    if (nextName === (session.user.name ?? '')) {
      setIsEditingName(false);
      setNameError('');
      return;
    }

    setNameError('');
    try {
      await updateProfile.mutateAsync({ name: nextName });
      toast.success(copy.nameSuccess);
      setIsEditingName(false);
    } catch (error) {
      console.error('update name error:', error);
      setNameError(error instanceof Error ? error.message : copy.nameFail);
      toast.error(copy.nameFail);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      setPasswordError(copy.currentPasswordRequired);
      return;
    }
    if (newPassword.length < AUTH_PASSWORD_MIN_LENGTH) {
      setPasswordError(copy.newPasswordMinLength);
      return;
    }

    const changePassword = (authClient as unknown as {
      changePassword?: (
        payload: {
          currentPassword: string;
          newPassword: string;
          revokeOtherSessions: boolean;
        },
        options?: {
          onSuccess?: () => void | Promise<void>;
          onError?: (ctx: { error: { message: string } }) => void;
        }
      ) => Promise<unknown>;
    }).changePassword;

    if (!changePassword) {
      setPasswordError(copy.passwordFail);
      toast.error(copy.passwordFail);
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError('');
    try {
      await changePassword(
        {
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        },
        {
          onSuccess: async () => {
            toast.success(copy.passwordSuccess);
            setCurrentPassword('');
            setNewPassword('');
            setShowPasswordEditor(false);
            router.refresh();
          },
          onError: (ctx) => {
            console.error('update password error:', ctx.error);
            setPasswordError(ctx.error.message);
            toast.error(copy.passwordFail);
          },
        }
      );
    } catch (error) {
      console.error('update password error:', error);
      setPasswordError(error instanceof Error ? error.message : copy.passwordFail);
      toast.error(copy.passwordFail);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSetupPassword = () => {
    if (session.user.email) {
      router.push(
        `/auth/forgot-password?email=${encodeURIComponent(session.user.email)}`
      );
    } else {
      router.push('/auth/forgot-password');
    }
    onClose();
  };

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          void invalidateWorkspaceAfterAuthChange(queryClient);
          onClose();
          router.replace('/');
        },
      },
    });
  };

  return (
    <div className="space-y-8">
      <AccountSectionHeading title={copy.profile.title} />

      <section
        className={cn(
          ACCOUNT_PANEL_CLASS,
          'flex flex-wrap items-center justify-between gap-5'
        )}
      >
        <div className="flex items-center gap-3.5">
          <Avatar className="size-16 border border-[#E8E8ED] bg-[#F5F5F7]">
            <AvatarImage src={avatarUrl} alt={session.user.name ?? 'User'} />
            <AvatarFallback>
              <User2Icon className="size-6 text-[#999]" />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className={ACCOUNT_EYEBROW_TEXT_CLASS}>
              {copy.profile.userName}
            </p>
            <p className={ACCOUNT_VALUE_TEXT_CLASS}>
              {session.user.name ?? '-'}
            </p>
            <p className={ACCOUNT_MUTED_TEXT_CLASS}>{session.user.email}</p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleAvatarButtonClick}
          disabled={!canUpdateAvatar || isUploadingAvatar}
          className={cn(ACCOUNT_PRIMARY_BUTTON_CLASS, 'h-10 px-4')}
        >
          {isUploadingAvatar ? copy.avatarUploading : copy.profile.avatar}
        </Button>
      </section>

      <section className={cn(ACCOUNT_PANEL_CLASS, 'space-y-3.5')}>
        <div className="grid grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-4 py-1">
          <p className={ACCOUNT_LABEL_TEXT_CLASS}>{copy.profile.userName}</p>
          <p className={ACCOUNT_BODY_TEXT_CLASS}>{session.user.name ?? '-'}</p>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              ACCOUNT_SOFT_ICON_BUTTON_CLASS,
              'h-9 rounded-[14px] px-3 text-[13px] font-medium'
            )}
            onClick={() => {
              setDraftName(session.user.name ?? '');
              setNameError('');
              setIsEditingName(true);
            }}
          >
            <PencilLineIcon className="size-4" />
            {copy.profile.editName}
          </Button>
        </div>

        <div className="grid grid-cols-[minmax(120px,180px)_1fr] items-center gap-4 py-1">
          <p className={ACCOUNT_LABEL_TEXT_CLASS}>{copy.profile.email}</p>
          <p className={ACCOUNT_MUTED_TEXT_CLASS}>{session.user.email}</p>
        </div>

        {isEditingName ? (
          <div className="rounded-xl border border-[#E8E8ED] bg-[#FAFAFA] p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder={copy.profile.namePlaceholder}
                className="h-10 rounded-xl border-[#D5D5DA] bg-white text-[14px] shadow-none focus-visible:border-[#1D1D1F] focus-visible:ring-0"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={ACCOUNT_SECONDARY_BUTTON_CLASS}
                  onClick={() => {
                    setIsEditingName(false);
                    setDraftName(session.user.name ?? '');
                    setNameError('');
                  }}
                >
                  {copy.profile.cancel}
                </Button>
                <Button
                  type="button"
                  className={ACCOUNT_PRIMARY_BUTTON_CLASS}
                  disabled={updateProfile.isPending}
                  onClick={() => void handleSaveName()}
                >
                  {updateProfile.isPending ? copy.profile.saving : copy.profile.save}
                </Button>
              </div>
            </div>
            {nameError ? (
              <p className="mt-3 text-sm text-[#D92D20]">{nameError}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={cn(ACCOUNT_PANEL_CLASS, 'space-y-3.5')}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={ACCOUNT_EYEBROW_TEXT_CLASS}>
              {copy.profile.security}
            </p>
            <h3 className={cn(ACCOUNT_VALUE_TEXT_CLASS, 'mt-2')}>
              {copy.profile.changePassword}
            </h3>
            <p className={cn(ACCOUNT_MUTED_TEXT_CLASS, 'mt-2')}>
              {copy.profile.passwordHint}
            </p>
          </div>

          {isLoadingAccounts ? (
            <Loader2Icon className="size-5 animate-spin text-[#999]" />
          ) : hasCredentialProvider ? (
            <Button
              type="button"
              className={cn(ACCOUNT_PRIMARY_BUTTON_CLASS, 'h-10 px-4')}
              onClick={() => {
                setShowPasswordEditor((prev) => !prev);
                setPasswordError('');
              }}
            >
              <ShieldCheckIcon className="size-4" />
              {copy.profile.changePassword}
            </Button>
          ) : session.user.email ? (
            <Button
              type="button"
              className={cn(ACCOUNT_PRIMARY_BUTTON_CLASS, 'h-10 px-4')}
              onClick={handleSetupPassword}
            >
              <MailIcon className="size-4" />
              {copy.profile.setupPassword}
            </Button>
          ) : null}
        </div>

        {hasCredentialProvider && showPasswordEditor ? (
          <div className="rounded-xl border border-[#E8E8ED] bg-[#FAFAFA] p-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="account-center-current-password"
                  className={ACCOUNT_LABEL_TEXT_CLASS}
                >
                  {copy.profile.currentPassword}
                </label>
                <Input
                  id="account-center-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="h-10 rounded-xl border-[#D5D5DA] bg-white"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="account-center-new-password"
                  className={ACCOUNT_LABEL_TEXT_CLASS}
                >
                  {copy.profile.newPassword}
                </label>
                <Input
                  id="account-center-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-10 rounded-xl border-[#D5D5DA] bg-white"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className={ACCOUNT_SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  setShowPasswordEditor(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setPasswordError('');
                }}
              >
                {copy.profile.cancel}
              </Button>
              <Button
                type="button"
                className={ACCOUNT_PRIMARY_BUTTON_CLASS}
                disabled={isUpdatingPassword}
                onClick={() => void handleUpdatePassword()}
              >
                {isUpdatingPassword
                  ? copy.profile.passwordSaving
                  : copy.profile.save}
              </Button>
            </div>
            {passwordError ? (
              <p className="mt-3 text-sm text-[#D92D20]">{passwordError}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={cn(ACCOUNT_PANEL_CLASS, 'flex items-center justify-between gap-4')}>
        <div>
          <p className={ACCOUNT_EYEBROW_TEXT_CLASS}>{copy.profile.signOut}</p>
          <p className={cn(ACCOUNT_MUTED_TEXT_CLASS, 'mt-2')}>
            {copy.profile.signedInAs}: {session.user.name ?? session.user.email}
          </p>
        </div>
        <Button
          type="button"
          className={ACCOUNT_PRIMARY_BUTTON_CLASS}
          onClick={() => void handleSignOut()}
        >
          <LogOutIcon className="size-4" />
          {copy.profile.signOut}
        </Button>
      </section>
    </div>
  );
}

function CreditsSection({
  userId,
  onShowTransactions,
}: {
  userId: string;
  onShowTransactions: () => void;
}) {
  const copy = makeAccountCenterCopy(useTranslations('BeatAPI.account'));
  const { openPricing } = usePricingModal();
  const {
    data: balance = 0,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useCreditBalance(userId);
  return (
    <div className="space-y-8">
      <AccountSectionHeading
        title={copy.credits.title}
        description={copy.credits.description}
      />

      <section className="rounded-[28px] border border-[#E7EBF3] bg-white p-6 shadow-[0_18px_44px_rgba(31,75,140,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="min-w-0 space-y-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8A94A6]">
              {copy.credits.balance}
            </p>
            <div className="flex items-center gap-3 text-[44px] font-semibold leading-none tracking-[-0.055em] text-[#111827]">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-[#EEF4FF] text-[#3468D8]">
                <ZapIcon className="size-5 fill-current" />
              </span>
              {isLoadingBalance
                ? '...'
                : balanceError
                  ? copy.credits.balanceUnavailable
                  : balance.toLocaleString()}
            </div>
            <p className="max-w-[560px] text-[14px] leading-6 text-[#667085]">
              {copy.credits.note}
            </p>
            {balanceError ? (
              <p className="text-[13px] leading-5 text-[#D92D20]">
                {balanceError.message}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[180px]">
            <Button
              type="button"
              className={cn(ACCOUNT_PRIMARY_BUTTON_CLASS, 'w-full rounded-[16px]')}
              onClick={openPricing}
            >
              <ShoppingCartIcon className="size-4" />
              {copy.credits.buy}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn(ACCOUNT_SECONDARY_BUTTON_CLASS, 'w-full rounded-[16px]')}
              onClick={onShowTransactions}
            >
              <CreditCardIcon className="size-4" />
              {copy.credits.viewHistory}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function TransactionSection({ userId }: { userId: string }) {
  const copy = makeAccountCenterCopy(useTranslations('BeatAPI.account'));
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);
  const filters = useMemo(
    () => (typeFilter ? [{ id: 'type', value: typeFilter }] : []),
    [typeFilter]
  );

  const { data, isLoading, error } = useCreditTransactions(
    userId,
    pageIndex,
    pageSize,
    search,
    sorting,
    filters
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const typeOptions = [
    CREDIT_TRANSACTION_TYPE.USAGE,
    CREDIT_TRANSACTION_TYPE.PURCHASE_PACKAGE,
    CREDIT_TRANSACTION_TYPE.REFUND,
    CREDIT_TRANSACTION_TYPE.REGISTER_GIFT,
    CREDIT_TRANSACTION_TYPE.EXPIRE,
  ];

  return (
    <div className="space-y-6">
      <AccountSectionHeading
        title={copy.transactions.title}
        description={copy.transactions.description}
      />

      <section className={cn(ACCOUNT_PANEL_CLASS, 'space-y-4')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A5AEC0]" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPageIndex(0);
              }}
              placeholder={copy.transactions.search}
              className="h-10 rounded-[16px] border-[#DCE6F8] bg-[#FCFDFF] pl-9 text-[15px] shadow-none placeholder:text-[#A5AEC0] focus-visible:border-[#CAD7F2] focus-visible:ring-[#CAD7F2]/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(
                'h-9 rounded-[14px] px-3 text-[13px] shadow-none',
                !typeFilter
                  ? 'border-[#AFC7FA] bg-[#EEF4FF] text-[#315FA8]'
                  : 'border-[#E8E8ED] bg-white text-[#667085]'
              )}
              onClick={() => {
                setTypeFilter('');
                setPageIndex(0);
              }}
            >
              {copy.transactions.all}
            </Button>
            {typeOptions.map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                className={cn(
                  'h-9 rounded-[14px] px-3 text-[13px] shadow-none',
                  typeFilter === type
                    ? 'border-[#AFC7FA] bg-[#EEF4FF] text-[#315FA8]'
                    : 'border-[#E8E8ED] bg-white text-[#667085]'
                )}
                onClick={() => {
                  setTypeFilter(type);
                  setPageIndex(0);
                }}
              >
                {copy.transactions.types[type]}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-[18px] border border-[#EEF1F6] px-4">
          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-[#667085]">
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              {copy.loading}
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm text-[#D92D20]">
              {error.message}
            </p>
          ) : items.length > 0 ? (
            items.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                copy={copy.transactions}
              />
            ))
          ) : (
            <p className="py-12 text-center text-sm text-[#98A2B3]">
              {copy.transactions.empty}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[#8A94A6]">
            {copy.transactions.page} {pageIndex + 1} / {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={ACCOUNT_SECONDARY_BUTTON_CLASS}
              disabled={pageIndex === 0 || isLoading}
              onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
            >
              <ChevronLeftIcon className="size-4" />
              {copy.transactions.previous}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={ACCOUNT_SECONDARY_BUTTON_CLASS}
              disabled={pageIndex + 1 >= pageCount || isLoading}
              onClick={() =>
                setPageIndex((value) => Math.min(pageCount - 1, value + 1))
              }
            >
              {copy.transactions.next}
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AccountCenterDialog({
  open,
  onOpenChange,
  section,
  onSectionChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: AccountCenterSection;
  onSectionChange: (section: AccountCenterSection) => void;
}) {
  const copy = makeAccountCenterCopy(useTranslations('BeatAPI.account'));
  const { data: session } = authClient.useSession();

  if (!session?.user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:!max-w-none overflow-hidden rounded-[36px] border border-[#E7E8EC] bg-white p-0 text-[#1D1D1F] shadow-[0_34px_110px_rgba(15,23,42,0.14)]"
        style={{
          width: 'min(1600px, calc(100vw - 64px))',
          maxWidth: 'none',
          maxHeight: 'min(940px, calc(100vh - 48px))',
        }}
      >
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>
        <div className="grid h-full min-h-[780px] grid-cols-[272px_minmax(0,1fr)]">
          <aside className="border-r border-[#E8E8EC] bg-[#F6F6F7] px-6 py-10">
            <p className="px-4 text-[15px] font-semibold text-[#1D1D1F]">
              {copy.title}
            </p>
            <nav className="mt-8 space-y-2">
              <AccountSectionButton
                section="profile"
                label={copy.sections.profile}
                active={section === 'profile'}
                onSelect={onSectionChange}
              />
            </nav>
          </aside>

          <section className="relative flex min-h-0 flex-col bg-white">
            <button
              type="button"
              aria-label={copy.close}
              className="absolute right-8 top-8 z-10 inline-flex size-10 items-center justify-center rounded-full text-[#999] transition hover:bg-[#F4F4F5] hover:text-[#1D1D1F]"
              onClick={() => onOpenChange(false)}
            >
              <XIcon className="size-5" />
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-10 lg:px-12">
              {section === 'profile' ? (
                <ProfileSection onClose={() => onOpenChange(false)} />
              ) : null}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
