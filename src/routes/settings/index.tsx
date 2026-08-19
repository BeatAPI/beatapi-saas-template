import { createFileRoute } from '@tanstack/react-router';
import { m } from "@/paraglide/messages.js";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { useSession } from "@/core/auth/client";
import { FolderOpen, Key } from "lucide-react";
import { Link } from "@/core/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function DashboardPage() {
  const { data: session } = useSession();
  const { data: apiKeysData } = useQuery({
    queryKey: ["user-apikeys"],
    queryFn: () => apiGet<unknown[]>("/api/apikeys"),
  });

  const apiKeys = apiKeysData?.length ?? null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{m["settings.title"]()}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {m["settings.welcome"]({ name: session?.user?.name || session?.user?.email || "" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{m["settings.apikeys.title"]()}</CardTitle>
            <Key className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apiKeys ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {m["settings.overview.apikeys_description"]()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{m["settings.overview.workspace"]()}</CardTitle>
            <FolderOpen className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{m["settings.overview.workspace_value"]()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {m["settings.overview.workspace_description"]()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m["settings.overview.quick_actions"]()}</CardTitle>
          <CardDescription>{m["settings.overview.quick_actions_description"]()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/canvas"
              className={cn(buttonVariants({ variant: "default" }), "gap-2")}
            >
              <FolderOpen className="size-4" />
              {m["settings.overview.create_project"]()}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute('/settings/')({
  component: DashboardPage,
});
