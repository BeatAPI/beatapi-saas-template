/**
 * Mail adapter — bridges BeatAPI's `@/mail` API surface to TanStack's
 * existing `@/core/email` module (emailManager).
 *
 * BeatAPI's mail module is deeply tied to next-intl (createTranslator) +
 * @react-email/* + an i18n message tree, none of which exist under TanStack's
 * paraglide i18n. Per the migration decision (Block 3), we do NOT port the
 * BeatAPI mail module. Instead we keep the function shape BeatAPI code calls
 * (`sendEmail(params) -> Promise<boolean>`) and route it through TanStack's
 * emailManager. Email templates / i18n rendering are deferred — for now only
 * raw (html/text) emails are supported; template emails log a warning and
 * fall back to a plain-text body.
 *
 * When richer templated email is needed later, extend TanStack's
 * `@/core/email` module directly rather than reviving the next-intl stack.
 */
import { emailManager, type EmailMessage } from '@/core/email';

/**
 * Parameters mirroring BeatAPI's mail module.
 * - Raw email: { to, subject, html, text?, locale? }
 * - Template email: { to, template, context, locale? }  (limited support here)
 */
export interface SendRawEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  locale?: string;
}

export interface SendTemplateParams {
  to: string;
  template: string;
  context: Record<string, any>;
  locale?: string;
}

export type SendEmailParams = SendRawEmailParams | SendTemplateParams;

/**
 * Send an email. Returns `true` on success (BeatAPI contract), `false` on
 * failure. Template emails are rendered as a simple text summary until the
 * template engine is restored.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  let message: EmailMessage;

  if ('template' in params) {
    // Template engine not ported — emit a readable plain-text summary.
    console.warn(
      `[mail] Template email requested but templates are not ported; ` +
        `sending plain-text fallback. template=${params.template}`
    );
    message = {
      to: params.to,
      subject: `[${params.template}]`,
      text: JSON.stringify(params.context, null, 2),
    };
  } else {
    message = {
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      from: params.from,
    };
  }

  try {
    const result = await emailManager.sendEmail(message);
    return result.success;
  } catch (error) {
    console.error('[mail] sendEmail failed:', error);
    return false;
  }
}

// Re-export for any code referencing the provider directly.
export { emailManager };
