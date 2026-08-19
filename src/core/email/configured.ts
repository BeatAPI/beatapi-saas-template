import { EmailManager } from '.';
import { MailgunProvider } from './mailgun';
import { ResendProvider } from './resend';

type Configs = Record<string, string>;

export function getConfiguredEmailProviderNames(configs: Configs): string[] {
  const names: string[] = [];
  if (configs.resend_api_key && configs.resend_sender_email) {
    names.push('resend');
  }
  if (
    configs.mailgun_api_key &&
    configs.mailgun_domain &&
    configs.mailgun_sender_email
  ) {
    names.push('mailgun');
  }
  return names;
}

export function hasConfiguredEmailProvider(configs: Configs): boolean {
  return getConfiguredEmailProviderNames(configs).length > 0;
}

export function buildEmailManager(configs: Configs): EmailManager {
  const manager = new EmailManager();
  const configured = getConfiguredEmailProviderNames(configs);
  const requestedDefault = configs.default_email_provider || 'resend';
  const defaultName = configured.includes(requestedDefault)
    ? requestedDefault
    : configured[0];

  if (configured.includes('resend')) {
    manager.addProvider(
      new ResendProvider({
        apiKey: configs.resend_api_key,
        defaultFrom: configs.resend_sender_email,
      }),
      defaultName === 'resend'
    );
  }

  if (configured.includes('mailgun')) {
    manager.addProvider(
      new MailgunProvider({
        apiKey: configs.mailgun_api_key,
        domain: configs.mailgun_domain,
        defaultFrom: configs.mailgun_sender_email,
        region: configs.mailgun_region === 'eu' ? 'eu' : 'us',
      }),
      defaultName === 'mailgun'
    );
  }

  return manager;
}
