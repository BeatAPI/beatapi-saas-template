
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DEFAULT_BEATAPI_BASE_URL,
  getBeatCanvasProviderPublicConfig,
} from '@/core/beatcanvas/providers/provider-config';
import { useTranslations } from '@/core/workspace-lib/shims/next-intl';
import { apiJsonGet, apiJsonPost } from '@/lib/api-client';

/** Custom plug glyph — the workspace's "connect your API" mark. */
function PlugGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 2.5v4.5" />
      <path d="M15 2.5v4.5" />
      <path d="M6.5 7h11v3.8a5.5 5.5 0 0 1-11 0V7Z" />
      <path d="M12 16.3v2.2" />
      <path d="M12 18.5c0 1.6 1.4 3 3 3h2.5" />
    </svg>
  );
}

const inputClassName =
  'h-11 w-full rounded-[12px] border border-white/[0.12] bg-white/[0.04] px-3.5 font-mono text-[13px] text-white outline-none transition placeholder:text-white/30 focus:border-[#ff7a33]/55 focus:ring-[3px] focus:ring-[#ff7a33]/15';

type BeatApiConfigState = {
  baseUrl: string;
  apiKeyConfigured: boolean;
};

function ApiConfigForm({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations('AppShell.header.apiConfig');
  const [state, setState] = useState<BeatApiConfigState | null>(null);
  const [host, setHost] = useState(DEFAULT_BEATAPI_BASE_URL);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiJsonGet<BeatApiConfigState>('/api/config/beatapi')
      .then((config) => {
        if (cancelled || !config) return;
        setState(config);
        setHost(config.baseUrl || DEFAULT_BEATAPI_BASE_URL);
      })
      .catch(() => {
        // unreadable config (signed out / DB down) — keep the preset host
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      await apiJsonPost('/api/config/beatapi', {
        baseUrl: host.trim() || DEFAULT_BEATAPI_BASE_URL,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      toast.success(t('saved'));
      setApiKey('');
      setState((prev) => ({
        baseUrl: host.trim() || DEFAULT_BEATAPI_BASE_URL,
        apiKeyConfigured: Boolean(apiKey.trim() || prev?.apiKeyConfigured),
      }));
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 px-6 py-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="beatapi-host"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
          >
            {t('hostLabel')}
          </label>
          <button
            type="button"
            className="text-[12px] font-medium text-[#ff8b4d] transition hover:text-[#ffa26b]"
            onClick={() => setHost(DEFAULT_BEATAPI_BASE_URL)}
          >
            {t('reset')}
          </button>
        </div>
        <input
          id="beatapi-host"
          value={host}
          onChange={(event) => setHost(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          className={inputClassName}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="beatapi-key"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
          >
            {t('keyLabel')}
          </label>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              state?.apiKeyConfigured
                ? 'border-[#ff7a33]/30 bg-[#ff7a33]/10 text-[#ff9a62]'
                : 'border-white/12 bg-white/[0.04] text-white/40'
            }`}
          >
            {state?.apiKeyConfigured ? t('keyConfigured') : t('keyNotConfigured')}
          </span>
        </div>
        <input
          id="beatapi-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t('keyPlaceholder')}
          autoComplete="off"
          className={inputClassName}
        />
        <p className="mt-2 text-[11px] leading-5 text-white/38">
          {t('connectHint')}
        </p>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="h-11 w-full rounded-[14px] bg-[#ff7a33] text-[14px] font-semibold text-[#1d1d1f] shadow-[0_8px_24px_rgba(255,122,51,0.24)] transition hover:bg-[#ff8a4d] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? t('saving') : t('save')}
      </button>
    </div>
  );
}

export function WorkspaceApiConfigDialog({
  providerId,
}: {
  providerId?: string | null;
}) {
  const t = useTranslations('AppShell.header.apiConfig');
  const provider = getBeatCanvasProviderPublicConfig(providerId);
  const [saveSignal, setSaveSignal] = useState(0);

  return (
    <Dialog>
      <DialogTrigger
        aria-label={t('triggerLabel')}
        title={t('triggerLabel')}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.035] text-[#a0a1a8] transition hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a33]/45"
      >
        <PlugGlyph className="size-[18px]" />
      </DialogTrigger>

      <DialogContent className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111214] p-0 text-[#f5f5f7] shadow-[0_34px_110px_rgba(0,0,0,0.62)] ring-0 sm:max-w-[480px] [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:text-white/45 [&_[data-slot=dialog-close]]:hover:bg-white/[0.07] [&_[data-slot=dialog-close]]:hover:text-white">
        <div className="border-b border-white/[0.08] px-6 pb-5 pt-6">
          <span className="mb-4 inline-flex size-10 items-center justify-center rounded-[14px] border border-[#ff7a33]/25 bg-[#ff7a33]/10 text-[#ff8b4d]">
            <PlugGlyph className="size-[18px]" />
          </span>
          <DialogHeader className="gap-2 pr-9 text-left">
            <DialogTitle className="text-[20px] font-semibold tracking-[-0.025em] text-white">
              {t('title')}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-5 text-white/48">
              {t('description')}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-white">
              {provider.label}
            </p>
            {provider.isDefault ? (
              <span className="rounded-full border border-[#ff7a33]/30 bg-[#ff7a33]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.13em] text-[#ff9a62]">
                {t('defaultBadge')}
              </span>
            ) : null}
          </div>
        </div>

        <ApiConfigForm key={saveSignal} onSaved={() => setSaveSignal((n) => n + 1)} />
      </DialogContent>
    </Dialog>
  );
}
