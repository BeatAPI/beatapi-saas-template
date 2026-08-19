import { createFileRoute } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { m } from "@/paraglide/messages.js";
import { useEffect, useState } from "react";
import { localizeHref } from "@/paraglide/runtime.js";
import { Link, useRouter } from "@/core/i18n/navigation";
import { signIn } from "@/core/auth/client";
import {
  classifyEmailSignInError,
  completeEmailAuthHandoff,
  getSafeAuthCallback,
  VerificationEmailDeliveryError,
} from "@/core/auth/registration-flow";
import { usePublicConfig } from "@/hooks/use-public-config";
import { apiPost } from "@/lib/api-client";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { TextField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const signInSchema = z.object({
  email: z.string().email(m["common.sign.email_placeholder"]()),
  password: z.string().min(1),
});

function SignInPage() {
    const router = useRouter();
  const [error, setError] = useState("");

  const [afterLoginUrl, setAfterLoginUrl] = useState('/');
  const signUpHref =
    afterLoginUrl === '/'
      ? '/sign-up'
      : `/sign-up?callbackUrl=${encodeURIComponent(afterLoginUrl)}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAfterLoginUrl(getSafeAuthCallback(params.get('callbackUrl')));
  }, []);

  const configQuery = usePublicConfig();
  const configs = configQuery.data ?? {};

  const configsLoaded = configQuery.isSuccess;
  const emailEnabled = configs.email_auth_enabled !== "false";
  const googleEnabled = configs.google_auth_enabled === "true";
  const passwordResetEnabled = configs.password_reset_enabled === "true";
  const emailVerificationEnabled = configs.email_verification_enabled === "true";
  const hasSocial = googleEnabled;
  const hasAnyMethod = emailEnabled || hasSocial;

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const result: any = await signIn.email({
          email: value.email,
          password: value.password,
        });
        if (result.error) {
          const errorKind = classifyEmailSignInError(result.error);
          if (errorKind === 'unverified' && emailVerificationEnabled) {
            const destination = await completeEmailAuthHandoff({
              email: value.email,
              afterLoginUrl,
              emailVerificationEnabled: true,
              localizeCallbackUrl: localizeHref,
              sendVerificationEmail: (params) =>
                apiPost('/api/auth/verification-email', params),
            });
            router.push(destination);
            return;
          }
          setError(
            errorKind === 'credentials'
              ? m['common.sign.invalid_email_or_password']()
              : m['common.sign.sign_in_failed']()
          );
        } else {
          await apiPost('/api/credits/welcome').catch(() => undefined);
          router.push(afterLoginUrl);
        }
      } catch (err: any) {
        setError(
          err instanceof VerificationEmailDeliveryError
            ? m["common.sign.verify_email_send_failed"]()
            : err.message || m["common.sign.sign_in_failed"]()
        );
      }
    },
  });

  async function handleGoogleSignIn() {
    await signIn.social({ provider: "google", callbackURL: afterLoginUrl });
  }

  return (
    <AuthPageShell title={m["common.sign.sign_in_title"]()}>
            {configsLoaded && !hasAnyMethod ? (
              <div className="rounded-[var(--beat-radius-sm)] border border-dashed border-white/15 p-6 text-center">
                <p className="text-sm font-medium">{m["common.sign.no_methods_title"]()}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {m["common.sign.no_methods_description"]()}
                </p>
              </div>
            ) : (
            <form
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
            >
              <FieldGroup>
                {error && (
                  <div className="rounded-[var(--beat-radius-sm)] border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                {hasSocial && (
                  <Field>
                    {googleEnabled && (
                      <Button variant="outline" type="button" onClick={handleGoogleSignIn}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4">
                          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor" />
                        </svg>
                        {m["common.sign.google_sign_in"]()}
                      </Button>
                    )}
                  </Field>
                )}

                {hasSocial && emailEnabled && (
                  <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                    {m["common.sign.or"]()}
                  </FieldSeparator>
                )}

                {emailEnabled && (
                  <>
                    <form.Field name="email">
                      {(field) => (
                        <TextField
                          field={field}
                          label={m["common.sign.email_title"]()}
                          type="email"
                          required
                          placeholder={m["common.sign.email_placeholder"]()}
                        />
                      )}
                    </form.Field>
                    <form.Field name="password">
                      {(field) => {
                        const err = field.state.meta.isTouched
                          ? (field.state.meta.errors?.[0] as any)
                          : null;
                        const errMsg =
                          err == null
                            ? null
                            : typeof err === "string"
                              ? err
                              : err.message
                                ? String(err.message)
                                : String(err);
                        return (
                          <Field>
                            <div className="flex items-center justify-between">
                              <FieldLabel htmlFor={field.name}>{m["common.sign.password_title"]()}</FieldLabel>
                              {passwordResetEnabled && (
                                <Link
                                  href="/forgot-password"
                                  className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
                                >
                                  {m["common.sign.forgot_password"]()}
                                </Link>
                              )}
                            </div>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="password"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              onBlur={field.handleBlur}
                              required
                              placeholder={m["common.sign.password_placeholder"]()}
                              aria-invalid={errMsg ? true : undefined}
                            />
                            {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}
                          </Field>
                        );
                      }}
                    </form.Field>
                    <Field>
                      <form.Subscribe selector={(s) => s.isSubmitting}>
                        {(isSubmitting) => (
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "..." : m["common.sign.sign_in_title"]()}
                          </Button>
                        )}
                      </form.Subscribe>
                      <FieldDescription className="text-center">
                        {m["common.sign.no_account"]()}{" "}
                        <Link href={signUpHref} className="underline underline-offset-4">
                          {m["common.sign.sign_up_title"]()}
                        </Link>
                      </FieldDescription>
                    </Field>
                  </>
                )}
              </FieldGroup>
            </form>
            )}
    </AuthPageShell>
  );
}

export const Route = createFileRoute('/(auth)/sign-in')({
  component: SignInPage,
});
