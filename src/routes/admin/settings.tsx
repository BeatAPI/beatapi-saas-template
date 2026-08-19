import { createFileRoute } from '@tanstack/react-router';
import { tDynamic } from "@/core/i18n/dynamic";
import { m } from "@/paraglide/messages.js";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { Save, ChevronDown, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getSettingTabs,
  getSettingGroups,
  getSettings,
  type Setting,
} from "@/modules/config/settings";
import { getTestSpec } from "@/modules/config/settings-test-specs";
import { SettingsTestDialog } from "@/components/admin/settings-test-dialog";

function AdminSettingsPage() {
  const placeholders: Record<string, string> = {
    creem_test_amount: m["admin.settings.placeholders.creem_test_amount"](),
    paypal_test_amount: m["admin.settings.placeholders.paypal_test_amount"](),
    alipay_test_amount: m["admin.settings.placeholders.alipay_test_amount"](),
    wechat_test_amount: m["admin.settings.placeholders.wechat_test_amount"](),
  };
  const queryClient = useQueryClient();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("general");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [testingGroup, setTestingGroup] = useState<string | null>(null);

  function toggleCollapse(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const tabs = getSettingTabs();
  const groups = getSettingGroups();
  const settings = getSettings();

  const { data: loadedConfigs, isLoading } = useQuery({
    queryKey: ["admin-config"],
    queryFn: () => apiGet<Record<string, string>>("/api/admin/config"),
  });

  useEffect(() => {
    if (loadedConfigs) setConfigs(loadedConfigs);
  }, [loadedConfigs]);

  function handleChange(name: string, value: string) {
    setConfigs((prev) => ({ ...prev, [name]: value }));
  }

  const saveMutation = useMutation({
    mutationFn: (toSave: Record<string, string>) =>
      apiPost("/api/admin/config", toSave),
    onSuccess: () => {
      toast.success(m["admin.settings.save_success"]());
      queryClient.invalidateQueries({ queryKey: ["admin-config"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || m["admin.settings.save_error"]());
    },
  });

  function handleSave() {
    const tabSettings = settings.filter((s) => s.tab === activeTab);
    const toSave: Record<string, string> = {};
    for (const s of tabSettings) {
      if (configs[s.name] !== undefined) {
        toSave[s.name] = configs[s.name];
      }
    }
    saveMutation.mutate(toSave);
  }

  const tabGroups = groups.filter((g) => g.tab === activeTab);
  const tabSettings = settings.filter((s) => s.tab === activeTab);

  return (
    <div className="p-6 space-y-6 md:max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{m["admin.settings.title"]()}</h1>
          <p className="text-muted-foreground">{m["admin.settings.description"]()}</p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
          <Save className="size-4" />
          {saveMutation.isPending ? m["admin.settings.saving"]() : m["admin.settings.save"]()}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto overflow-y-hidden">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
              activeTab === tab.name
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tDynamic(`admin.settings.tabs.${tab.name}`)}
          </button>
        ))}
      </div>

      {/* Groups */}
      {isLoading ? (
        <div className="text-muted-foreground">{m["admin.loading"]()}</div>
      ) : (
        tabGroups.map((group) => {
          const groupSettings = tabSettings.filter((s) => s.group === group.name);
          if (groupSettings.length === 0) return null;

          const testSpec = getTestSpec(group.name);
          return (
            <Card key={group.name}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleCollapse(group.name)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle>{tDynamic(`admin.settings.groups.${group.name}.title`)}</CardTitle>
                  <div className="flex items-center gap-2">
                    {testSpec && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTestingGroup(group.name);
                        }}
                      >
                        <FlaskConical className="size-3.5" />
                        {m["admin.settings.test.button"]()}
                      </Button>
                    )}
                    <ChevronDown
                      className={`size-5 text-muted-foreground transition-transform ${
                        collapsed.has(group.name) ? "-rotate-90" : ""
                      }`}
                    />
                  </div>
                </div>
              </CardHeader>
              {!collapsed.has(group.name) && (
                <CardContent className="space-y-4">
                  {groupSettings.map((setting) => (
                    <SettingField
                      key={setting.name}
                      setting={setting}
                      label={tDynamic(`admin.settings.fields.${setting.name}`)}
                      placeholder={placeholders[setting.name] ?? setting.placeholder}
                      value={configs[setting.name] ?? setting.defaultValue ?? ""}
                      onChange={(v) => handleChange(setting.name, v)}
                    />
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      {testingGroup && getTestSpec(testingGroup) && (
        <SettingsTestDialog
          open={!!testingGroup}
          onOpenChange={(open) => !open && setTestingGroup(null)}
          group={testingGroup}
          spec={getTestSpec(testingGroup)!}
          groupTitle={tDynamic(`admin.settings.groups.${testingGroup}.title`)}
        />
      )}
    </div>
  );
}

function SettingField({
  setting,
  label,
  placeholder,
  value,
  onChange,
}: {
  setting: Setting;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (setting.type === "switch") {
    return (
      <div className="space-y-2">
        <Label htmlFor={setting.name}>{label}</Label>
        <div>
          <Switch
            id={setting.name}
            checked={value === "true"}
            onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          />
        </div>
      </div>
    );
  }

  if (setting.type === "select" && setting.options) {
    return (
      <div className="space-y-2">
        <Label htmlFor={setting.name}>{label}</Label>
        <Select value={value} onValueChange={(v) => onChange(v || "")}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder || "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {setting.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (setting.type === "textarea") {
    return (
      <div className="space-y-2">
        <Label htmlFor={setting.name}>{label}</Label>
        <textarea
          id={setting.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={setting.name}>{label}</Label>
      <Input
        id={setting.name}
        type={setting.type === "password" ? "password" : setting.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export const Route = createFileRoute('/admin/settings')({
  component: AdminSettingsPage,
});
