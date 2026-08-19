import { createFileRoute } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { m } from "@/paraglide/messages.js";
import { useState } from "react";
import { localizeHref } from "@/paraglide/runtime.js";
import { Link } from "@/core/i18n/navigation";
import { requestPasswordReset } from "@/core/auth/client";
import { usePublicConfig } from "@/hooks/use-public-config";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { TextField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";

const forgotSchema = z.object({
  email: z.string().email(m["common.sign.email_placeholder"]()),
});

function ForgotPasswordPage() {
    const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const configQuery = usePublicConfig();
  const configs = configQuery.data ?? {};

  const configsLoaded = configQuery.isSuccess;
  const passwordResetEnabled = configs.password_reset_enabled === "true";

  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: forgotSchema },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const origin = window.location.origin;
        const redirectTo = `${origin}${localizeHref("/reset-password")}`;
        const result = await requestPasswordReset({ email: value.email, redirectTo });
        if (result.error) {
          setError(
            result.error.message ||
              m["common.sign.reset_password_request_failed"]()
          );
        } else {
          setSentEmail(value.email);
          setSent(true);
        }
      } catch (err: any) {
        setError(
          err.message || m["common.sign.reset_password_request_failed"]()
        );
      }
    },
  });

  return (
    <AuthPageShell
      title={
        sent
          ? m["common.sign.reset_link_sent_title"]()
          : m["common.sign.forgot_password_title"]()
      }
    >
      {!sent && (
        <p className="mb-5 text-center text-sm text-muted-foreground">
          {m["common.sign.forgot_password_description"]()}
        </p>
      )}
            {configsLoaded && !passwordResetEnabled ? (
              <FieldGroup>
                <div className="rounded-[var(--beat-radius-sm)] border border-dashed border-white/15 p-6 text-center">
                  <p className="text-sm font-medium">
                    {m["common.sign.password_reset_unavailable_title"]()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m["common.sign.password_reset_unavailable_description"]()}
                  </p>
                </div>
                <Field>
                  <Link
                    href="/sign-in"
                    className="text-sm text-center underline underline-offset-4"
                  >
                    {m["common.sign.back_to_sign_in"]()}
                  </Link>
                </Field>
              </FieldGroup>
            ) : sent ? (
              <FieldGroup>
                <p className="text-sm text-muted-foreground text-center">
                  {m["common.sign.reset_link_sent_description"]({ email: sentEmail })}
                </p>
                <Field>
                  <Link
                    href="/sign-in"
                    className="text-sm text-center underline underline-offset-4"
                  >
                    {m["common.sign.back_to_sign_in"]()}
                  </Link>
                </Field>
              </FieldGroup>
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
                  <Field>
                    <form.Subscribe selector={(s) => s.isSubmitting}>
                      {(isSubmitting) => (
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? "..." : m["common.sign.send_reset_link"]()}
                        </Button>
                      )}
                    </form.Subscribe>
                    <FieldDescription className="text-center">
                      <Link href="/sign-in" className="underline underline-offset-4">
                        {m["common.sign.back_to_sign_in"]()}
                      </Link>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            )}
    </AuthPageShell>
  );
}

export const Route = createFileRoute('/(auth)/forgot-password')({
  component: ForgotPasswordPage,
});
