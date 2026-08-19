import { createFileRoute } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { m } from "@/paraglide/messages.js";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/core/i18n/navigation";
import { resetPassword } from "@/core/auth/client";
import { AUTH_PASSWORD_MIN_LENGTH } from "@/core/auth/registration-flow";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { TextField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";

const resetSchema = z
  .object({
    password: z.string().min(
      AUTH_PASSWORD_MIN_LENGTH,
      m["common.sign.password_min_length"]({ min: AUTH_PASSWORD_MIN_LENGTH })
    ),
    confirmPassword: z.string().min(
      AUTH_PASSWORD_MIN_LENGTH,
      m["common.sign.password_min_length"]({ min: AUTH_PASSWORD_MIN_LENGTH })
    ),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: m["common.sign.password_mismatch"](),
  });

function ResetPasswordPage() {
    const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    const linkError = params.get("error");
    setToken(linkError ? null : tokenParam);
    setTokenChecked(true);
  }, []);

  const form = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    validators: { onSubmit: resetSchema },
    onSubmit: async ({ value }) => {
      setError("");
      if (!token) {
        setError(m["common.sign.reset_password_missing_token"]());
        return;
      }
      try {
        const result = await resetPassword({ newPassword: value.password, token });
        if (result.error) {
          setError(
            result.error.message || m["common.sign.reset_password_failed"]()
          );
        } else {
          setSuccess(true);
          setTimeout(() => router.push("/sign-in"), 1500);
        }
      } catch (err: any) {
        setError(err.message || m["common.sign.reset_password_failed"]());
      }
    },
  });

  return (
    <AuthPageShell title={m["common.sign.reset_password_title"]()}>
      {!success && tokenChecked && token && (
        <p className="mb-5 text-center text-sm text-muted-foreground">
          {m["common.sign.reset_password_description"]()}
        </p>
      )}
            {!tokenChecked ? null : !token ? (
              <FieldGroup>
                <div className="rounded-[var(--beat-radius-sm)] border border-red-500/25 bg-red-500/10 p-3 text-center text-sm text-red-400">
                  {m["common.sign.reset_password_invalid_token"]()}
                </div>
                <Field>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-center underline underline-offset-4"
                  >
                    {m["common.sign.forgot_password_title"]()}
                  </Link>
                </Field>
              </FieldGroup>
            ) : success ? (
              <FieldGroup>
                <p className="text-sm text-center">{m["common.sign.reset_password_success"]()}</p>
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
                  <form.Field name="password">
                    {(field) => (
                      <TextField
                        field={field}
                        label={m["common.sign.new_password_title"]()}
                        type="password"
                        required
                        placeholder={m["common.sign.new_password_placeholder"]()}
                      />
                    )}
                  </form.Field>
                  <form.Field name="confirmPassword">
                    {(field) => (
                      <TextField
                        field={field}
                        label={m["common.sign.confirm_password_title"]()}
                        type="password"
                        required
                        placeholder={m["common.sign.confirm_new_password_placeholder"]()}
                      />
                    )}
                  </form.Field>
                  <Field>
                    <form.Subscribe selector={(s) => s.isSubmitting}>
                      {(isSubmitting) => (
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? "..." : m["common.sign.reset_password_submit"]()}
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

export const Route = createFileRoute('/(auth)/reset-password')({
  component: ResetPasswordPage,
});
