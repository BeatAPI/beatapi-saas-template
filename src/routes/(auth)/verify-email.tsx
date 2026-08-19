import { createFileRoute } from '@tanstack/react-router';
import { m } from "@/paraglide/messages.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { deLocalizeHref, localizeHref } from "@/paraglide/runtime.js";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/core/i18n/navigation";
import { authClient, useSession } from "@/core/auth/client";
import { apiPost } from "@/lib/api-client";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";

const RESEND_COOLDOWN_SECONDS = 60;

function safeDecodeCallbackUrl(raw?: string | null) {
  if (!raw) return "/";
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("/")) return decoded;
    return "/";
  } catch {
    return "/";
  }
}

function stripLocalePrefix(path: string) {
  if (!path?.startsWith("/")) return "/";
  return deLocalizeHref(path);
}

function getCooldownKey(email?: string | null) {
  return `verify-email:lastSentAt:${String(email || "").toLowerCase()}`;
}

function getCooldownRemainingSeconds(email?: string | null) {
  if (typeof window === "undefined") return 0;
  if (!email) return 0;
  const raw = window.localStorage.getItem(getCooldownKey(email));
  const last = raw ? Number(raw) : 0;
  if (!last || Number.isNaN(last)) return 0;
  const elapsedSeconds = Math.floor((Date.now() - last) / 1000);
  return Math.max(0, RESEND_COOLDOWN_SECONDS - elapsedSeconds);
}

function markSentNow(email?: string | null) {
  if (typeof window === "undefined") return;
  if (!email) return;
  try {
    window.localStorage.setItem(getCooldownKey(email), String(Date.now()));
  } catch {}
}

function VerifyEmailPage() {
    const router = useRouter();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [paramsReady, setParamsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const lastSessionCheckAtRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("email");
    const cb = params.get("callbackUrl");
    const sent = params.get("sent");

    setEmail(e);
    setCallbackUrl(cb);
    setParamsReady(true);

    if (sent === "confirmed" || sent === "1" || sent === '"1"') {
      if (getCooldownRemainingSeconds(e) === 0) {
        markSentNow(e);
      }
      setCooldownSeconds(getCooldownRemainingSeconds(e));
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("sent");
        window.history.replaceState({}, "", url.toString());
      } catch {}
    } else {
      setCooldownSeconds(getCooldownRemainingSeconds(e));
    }
  }, []);

  // If user lands here without context, send to sign-in.
  useEffect(() => {
    if (paramsReady && !email && !callbackUrl) {
      router.replace("/sign-in");
    }
  }, [paramsReady, email, callbackUrl, router]);

  const nextUrl = useMemo(() => {
    const decoded = safeDecodeCallbackUrl(callbackUrl);
    return stripLocalePrefix(decoded);
  }, [callbackUrl]);


  const signInPath = useMemo(() => {
    const query = new URLSearchParams();
    query.set("callbackUrl", nextUrl || "/");
    return `/sign-in?${query.toString()}`;
  }, [nextUrl]);

  const hardNavigateToNextUrl = () => {
    if (typeof window === "undefined") return;
    window.location.assign(localizeHref(nextUrl));
  };

  const hardNavigateToSignIn = (prefillEmail?: string) => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams();
    if (prefillEmail) query.set("email", prefillEmail);
    query.set("callbackUrl", nextUrl || "/");
    window.location.assign(localizeHref(`/sign-in?${query.toString()}`));
  };

  const checkSessionAndRedirect = async () => {
    const now = Date.now();
    if (now - lastSessionCheckAtRef.current < 800) return;
    lastSessionCheckAtRef.current = now;
    try {
      const { data } = await authClient.getSession();
      if (data?.user) {
        hardNavigateToNextUrl();
      }
    } catch {}
  };

  // Cooldown ticker
  useEffect(() => {
    if (!paramsReady) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds(getCooldownRemainingSeconds(email));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [email, paramsReady]);

  // If session exists, redirect to next.
  useEffect(() => {
    if (!isPending && session?.user) {
      hardNavigateToNextUrl();
    }
  }, [isPending, session?.user, nextUrl]);

  // Brief polling on mount: detect verification link → cookie → session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      await checkSessionAndRedirect();
      if (attempts >= maxAttempts) return;
      const { data } = await authClient.getSession();
      if (!data?.user) {
        window.setTimeout(tick, 1000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [nextUrl]);

  // Cross-tab sync: re-check session on focus / visibility change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => void checkSessionAndRedirect();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkSessionAndRedirect();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [nextUrl]);

  const handleResend = async () => {
    if (!email) {
      toast.error(m["common.sign.verify_email_email_required"]());
      return;
    }
    if (loading) return;
    if (getCooldownRemainingSeconds(email) > 0) return;

    try {
      setLoading(true);
      await apiPost('/api/auth/verification-email', {
        email,
        callbackURL: localizeHref(nextUrl || "/"),
      });
      markSentNow(email);
      setCooldownSeconds(getCooldownRemainingSeconds(email));
    } catch (e: any) {
      toast.error(m["common.sign.verify_email_send_failed"]());
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (session?.user) {
      hardNavigateToNextUrl();
      return;
    }
    void (async () => {
      await checkSessionAndRedirect();
      const { data } = await authClient.getSession();
      if (!data?.user) {
        // Always send the user to sign-in. If they haven't verified yet,
        // sign-in will surface the correct error there — we deliberately
        // don't expose an unauthenticated "is X verified?" oracle.
        const targetEmail = String(email || "").trim().toLowerCase();
        hardNavigateToSignIn(targetEmail);
      }
    })();
  };

  return (
    <AuthPageShell title={m["common.sign.verify_email_page_title"]()}>
      <p className="mb-5 text-center text-xs text-muted-foreground md:text-sm">
        {m["common.sign.verify_email_page_description"]()}
        {email ? ` ${email}` : ""}
      </p>
            <div className="grid gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading || cooldownSeconds > 0}
                onClick={handleResend}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : cooldownSeconds > 0 ? (
                  m["common.sign.resend_verification_countdown"]({ seconds: cooldownSeconds })
                ) : (
                  m["common.sign.resend_verification"]()
                )}
              </Button>

              <Button
                type="button"
                className="beat-btn-primary w-full"
                disabled={isPending}
                onClick={handleContinue}
              >
                {isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  m["common.sign.verify_email_continue"]()
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="beat-btn-ghost w-full"
                onClick={() => router.push(signInPath)}
              >
                {m["common.sign.back_to_sign_in"]()}
              </Button>
            </div>
      <p className="mt-5 w-full text-center text-xs text-muted-foreground">
        {m["common.sign.verify_email_tip"]()}
      </p>
    </AuthPageShell>
  );
}

export const Route = createFileRoute('/(auth)/verify-email')({
  component: VerifyEmailPage,
});
