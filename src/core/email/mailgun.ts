import { render } from '@react-email/components';

import type {
  EmailConfigs,
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from '.';

export interface MailgunConfigs extends EmailConfigs {
  apiKey: string;
  domain: string;
  defaultFrom?: string;
  region?: 'us' | 'eu';
}

function basicAuth(value: string) {
  const token = `api:${value}`;
  if (typeof btoa === 'function') return btoa(token);
  return Buffer.from(token).toString('base64');
}

export class MailgunProvider implements EmailProvider {
  readonly name = 'mailgun';
  configs: MailgunConfigs;

  constructor(configs: MailgunConfigs) {
    this.configs = configs;
  }

  async sendEmail(email: EmailMessage): Promise<EmailSendResult> {
    try {
      const from = email.from || this.configs.defaultFrom;
      if (!from) throw new Error('Mailgun sender email is required');

      const form = new FormData();
      form.set('from', from);
      for (const to of Array.isArray(email.to) ? email.to : [email.to]) {
        form.append('to', to);
      }
      for (const cc of email.cc
        ? Array.isArray(email.cc)
          ? email.cc
          : [email.cc]
        : []) {
        form.append('cc', cc);
      }
      for (const bcc of email.bcc
        ? Array.isArray(email.bcc)
          ? email.bcc
          : [email.bcc]
        : []) {
        form.append('bcc', bcc);
      }

      form.set('subject', email.subject);
      if (email.text) form.set('text', email.text);
      if (email.html) form.set('html', email.html);
      if (email.react) form.set('html', await render(email.react));
      if (email.replyTo) form.set('h:Reply-To', email.replyTo);
      if (email.priority) form.set('h:X-Priority', email.priority);

      for (const [name, value] of Object.entries(email.headers || {})) {
        form.set(`h:${name}`, value);
      }
      for (const tag of email.tags || []) form.append('o:tag', tag);
      for (const attachment of email.attachments || []) {
        const content =
          typeof attachment.content === 'string'
            ? attachment.content
            : new Uint8Array(attachment.content);
        form.append(
          'attachment',
          new Blob([content], {
            type: attachment.contentType || 'application/octet-stream',
          }),
          attachment.filename
        );
      }

      const origin =
        this.configs.region === 'eu'
          ? 'https://api.eu.mailgun.net'
          : 'https://api.mailgun.net';
      const response = await fetch(
        `${origin}/v3/${encodeURIComponent(this.configs.domain)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basicAuth(this.configs.apiKey)}`,
          },
          body: form,
        }
      );
      const result = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(result.message || `Mailgun request failed (${response.status})`);
      }

      return {
        success: true,
        messageId: result.id,
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Mailgun send failed',
        provider: this.name,
      };
    }
  }
}
