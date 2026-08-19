
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  LogOutIcon,
  Settings2Icon,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AccountCenterDialog,
  type AccountCenterSection,
} from '@/components/account/account-center-dialog';
import { UserAvatar } from '@/components/layout/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocaleRouter } from '@/core/i18n/navigation';
import { invalidateWorkspaceAfterAuthChange } from '@/core/workspace-lib/app/workspace-query-invalidation';
import { authClient } from '@/core/workspace-lib/auth-client';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';

interface UserButtonProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  compact?: boolean;
}

export function UserButton({ user, compact = false }: UserButtonProps) {
  const copy = useTranslations('BeatAPI.userButton');
  const localeRouter = useLocaleRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [accountCenterOpen, setAccountCenterOpen] = useState(false);
  const [accountCenterSection, setAccountCenterSection] =
    useState<AccountCenterSection>('profile');

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = user.name || user.email || copy('user');

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          void invalidateWorkspaceAfterAuthChange(queryClient);
          localeRouter.replace('/');
        },
        onError: (error) => {
          console.error('sign out error:', error);
          toast.error(copy('logoutFailed'));
        },
      },
    });
  }

  function openAccountSection(section: AccountCenterSection) {
    setOpen(false);
    setAccountCenterSection(section);
    setAccountCenterOpen(true);
  }

  const triggerClassName = compact
    ? 'inline-flex items-center justify-center translate-y-px rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4]/30'
    : 'inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4]/30';

  if (!mounted) {
    return (
      <button type="button" aria-label={displayName} className={triggerClassName}>
        <UserAvatar
          name={displayName}
          image={user.image ?? null}
          className="size-8 cursor-pointer border border-slate-200"
        />
      </button>
    );
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger className={triggerClassName}>
          <UserAvatar
            name={displayName}
            image={user.image ?? null}
            className="size-8 cursor-pointer border border-slate-200 ring-2 ring-transparent transition-all hover:ring-[#4285F4]/18 active:scale-[0.98]"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-[264px] rounded-[24px] border border-[#E5E5EA] bg-white p-2 text-[#1D1D1F] shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <UserAvatar
              name={displayName}
              image={user.image ?? null}
              className="size-9 border border-slate-200"
            />
            <div className="min-w-0 flex-1 space-y-1 leading-none">
              <p className="truncate text-[15px] font-semibold text-[#1D1D1F]">
                {displayName}
              </p>
              <p className="truncate text-sm text-[#6E6E73]">
                {user.email || ''}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator className="mx-2 my-1 bg-[#E5E5EA]" />

          <DropdownMenuItem
            className="cursor-pointer rounded-2xl px-4 py-3 text-[15px] text-[#1D1D1F] hover:bg-[#F5F5F7] focus:bg-[#F5F5F7] focus:text-[#1D1D1F]"
            onClick={() => openAccountSection('profile')}
          >
            <Settings2Icon className="size-4 shrink-0" />
            <span className="text-sm">{copy('profile')}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="mx-2 my-1 bg-[#E5E5EA]" />
          <DropdownMenuItem
            className="cursor-pointer rounded-2xl px-4 py-3 text-[15px] text-[#1D1D1F] hover:bg-[#F5F5F7] focus:bg-[#F5F5F7] focus:text-[#1D1D1F]"
            onClick={() => {
              setOpen(false);
              void handleSignOut();
            }}
          >
            <LogOutIcon className="size-4" />
            <span className="text-sm">{copy('logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountCenterDialog
        open={accountCenterOpen}
        onOpenChange={setAccountCenterOpen}
        section={accountCenterSection}
        onSectionChange={setAccountCenterSection}
      />
    </>
  );
}
