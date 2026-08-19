
import { useEffect } from "react";
import { useSession } from "@/core/auth/client";
import { useRouter } from "@/core/i18n/navigation";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { AppSidebar, type NavItem } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { m } from "@/paraglide/messages.js";

export function AppLayout({
  children,
  navItems,
  footerNavItems,
  brand,
  brandHref = "/",
  mobileBrand,
  headerExtra,
  profileHref,
  requirePermission,
  unauthorizedRedirect = "/settings",
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  footerNavItems?: NavItem[];
  brand: React.ReactNode;
  brandHref?: string;
  mobileBrand?: React.ReactNode;
  headerExtra?: React.ReactNode;
  profileHref?: string;
  requirePermission?: string;
  unauthorizedRedirect?: string;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // Only query permissions once we have a session and a permission gate.
  const permissionsEnabled = !!session?.user && !!requirePermission;
  const permissionsQuery = useUserPermissions(permissionsEnabled);
  const isAdmin = permissionsQuery.data?.isAdmin === true;

  // Authorization resolution mirrors the original imperative flow:
  // - no permission gate → authorized once a session exists
  // - permission gate → authorized only when the query resolves with isAdmin
  const authorized = !!session?.user && (!requirePermission || isAdmin);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      router.push("/sign-in");
      return;
    }

    if (!requirePermission) return;

    // Wait for the permissions query to resolve before deciding.
    if (permissionsQuery.isPending) return;

    if (permissionsQuery.isError || !isAdmin) {
      router.push(unauthorizedRedirect);
    }
  }, [
    isPending,
    session,
    router,
    requirePermission,
    unauthorizedRedirect,
    permissionsQuery.isPending,
    permissionsQuery.isError,
    isAdmin,
  ]);

  if (isPending || !authorized || !session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">
            {m["common.ui.loading"]()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        brand={brand}
        brandHref={brandHref}
        navItems={navItems}
        footerNavItems={footerNavItems}
        footer={
          <UserMenu
            name={session.user.name || "User"}
            email={session.user.email}
            image={session.user.image}
            profileHref={profileHref}
          />
        }
      />
      {/* min-w-0: let the inset shrink below its content's min-content width —
          otherwise wide tables stretch the page and force horizontal scroll
          instead of scrolling inside their own overflow-x-auto wrappers */}
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
          <div className="flex-1" />
          {headerExtra && (
            <div className="flex items-center gap-1 px-4">{headerExtra}</div>
          )}
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
