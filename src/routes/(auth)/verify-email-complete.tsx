import { createFileRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { envConfigs } from '@/config';
import { Link } from '@/core/i18n/navigation';
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { getEmailVerificationCompletionPath } from '@/core/auth/registration-flow';
import { m } from '@/paraglide/messages.js';

function VerifyEmailCompletePage() {
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const target = getEmailVerificationCompletionPath(window.location.hash);
    if (!target) {
      setInvalid(true);
      return;
    }
    window.location.replace(target);
  }, []);

  return (
    <AuthPageShell
      title={
        invalid
          ? m['common.sign.verify_email_invalid_link']()
          : m['common.sign.verify_email_completing']()
      }
    >
      <div className="flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
            {invalid ? (
              <Link href="/sign-in" className="underline underline-offset-4">
                {m['common.sign.back_to_sign_in']()}
              </Link>
            ) : (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                <p>{m['common.sign.verify_email_signing_in']()}</p>
              </>
            )}
      </div>
    </AuthPageShell>
  );
}

export const Route = createFileRoute('/(auth)/verify-email-complete')({
  head: () => ({
    meta: [
      { title: `${m['common.sign.verify_email_completing']()} - ${envConfigs.app_name}` },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: VerifyEmailCompletePage,
});
