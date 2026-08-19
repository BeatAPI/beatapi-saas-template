import { createFileRoute } from '@tanstack/react-router';
import { m } from "@/paraglide/messages.js";
import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type Column } from "@/components/data-table";
import {
  apiDelete,
  apiGet,
  apiPost,
  pageQuery,
  type PageResult,
} from "@/lib/api-client";

interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
}

interface RoleInfo {
  id: string;
  name: string;
  title: string;
}

interface UserRoleInfo {
  roleId: string;
  roleName: string;
  roleTitle: string;
}

const PAGE_SIZE = 10;

function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Role management dialog
  const [managingUser, setManagingUser] = useState<User | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ["admin-users", page, debouncedSearch],
    queryFn: () =>
      apiGet<PageResult<User>>(
        pageQuery("/api/admin/users", {
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
        })
      ),
    placeholderData: keepPreviousData,
  });

  // Role dialog queries — only active while a user is being managed.
  const allRolesQuery = useQuery({
    queryKey: ["admin-roles-all"],
    queryFn: () =>
      apiGet<PageResult<RoleInfo>>("/api/admin/roles?page=1&pageSize=999"),
    enabled: !!managingUser,
  });

  const userRolesQuery = useQuery({
    queryKey: ["user-roles", managingUser?.id],
    queryFn: () =>
      apiGet<UserRoleInfo[]>(`/api/admin/roles?userId=${managingUser!.id}`),
    enabled: !!managingUser,
  });

  const allRoles = allRolesQuery.data?.items ?? [];
  const userRoleIds = new Set(
    (userRolesQuery.data ?? []).map((r) => r.roleId)
  );

  function openRoleDialog(u: User) {
    setManagingUser(u);
  }

  const assignRoleMutation = useMutation({
    mutationFn: (roleId: string) =>
      apiPost("/api/admin/roles/assign", {
        userId: managingUser!.id,
        roleId,
      }),
    onSuccess: () => {
      toast.success(m["admin.users.role_assigned"]());
      queryClient.invalidateQueries({
        queryKey: ["user-roles", managingUser?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRoleMutation = useMutation({
    mutationFn: (roleId: string) =>
      apiDelete(
        `/api/admin/roles/assign?userId=${managingUser!.id}&roleId=${roleId}`
      ),
    onSuccess: () => {
      toast.success(m["admin.users.role_removed"]());
      queryClient.invalidateQueries({
        queryKey: ["user-roles", managingUser?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggling =
    assignRoleMutation.isPending || removeRoleMutation.isPending;

  function toggleRole(roleId: string) {
    if (!managingUser || toggling) return;
    if (userRoleIds.has(roleId)) {
      removeRoleMutation.mutate(roleId);
    } else {
      assignRoleMutation.mutate(roleId);
    }
  }

  const columns: Column<User>[] = [
    {
      header: m["admin.users.user_col"](),
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={u.image || undefined} />
            <AvatarFallback className="text-xs">
              {(u.name || u.email).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{u.name || "—"}</span>
        </div>
      ),
    },
    {
      header: m["admin.users.email_col"](),
      cell: (u) => u.email,
    },
    {
      header: m["admin.users.joined_col"](),
      cell: (u) => (
        <span className="text-muted-foreground">
          {new Date(u.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: m["admin.users.actions_col"](),
      className: "w-[80px]",
      cell: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openRoleDialog(u)}>
              <Shield className="size-4" />
              {m["admin.users.manage_roles_title"]()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{m["admin.users.title"]()}</h1>
        <p className="text-muted-foreground">{m["admin.users.description"]()}</p>
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={listQuery.data?.items ?? []}
            total={listQuery.data?.total ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(u) => u.id}
            emptyText={m["admin.users.no_users"]()}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching}
          />
        </CardContent>
      </Card>

      {/* Role Management Dialog */}
      <Dialog open={!!managingUser} onOpenChange={(v) => !v && setManagingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m["admin.users.manage_roles_title"]()}</DialogTitle>
            <DialogDescription>{m["admin.users.manage_roles_description"]()}</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-3 py-4">
            {allRoles.map((r) => (
              <label key={r.id} className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={userRoleIds.has(r.id)}
                  onCheckedChange={() => toggleRole(r.id)}
                  disabled={toggling}
                />
                <div>
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.name}</div>
                </div>
              </label>
            ))}
            {allRoles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{m["admin.roles.no_roles"]()}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagingUser(null)}>{m["admin.roles.cancel"]()}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export const Route = createFileRoute('/admin/users')({
  component: UsersPage,
});
