import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEmailManager,
  getConfiguredEmailProviderNames,
  hasConfiguredEmailProvider,
} from './configured';

test('email configuration discovers only complete providers', () => {
  assert.deepEqual(
    getConfiguredEmailProviderNames({
      resend_api_key: 're_test',
      resend_sender_email: 'hello@example.com',
      mailgun_api_key: 'key-test',
      mailgun_domain: 'mg.example.com',
      mailgun_sender_email: 'hello@mg.example.com',
    }),
    ['resend', 'mailgun']
  );
  assert.equal(hasConfiguredEmailProvider({ resend_api_key: 'incomplete' }), false);
});

test('email manager honors Mailgun as the configured default', () => {
  const manager = buildEmailManager({
    default_email_provider: 'mailgun',
    resend_api_key: 're_test',
    resend_sender_email: 'hello@example.com',
    mailgun_api_key: 'key-test',
    mailgun_domain: 'mg.example.com',
    mailgun_sender_email: 'hello@mg.example.com',
    mailgun_region: 'eu',
  });

  assert.deepEqual(manager.getProviderNames(), ['resend', 'mailgun']);
  assert.equal(manager.getProvider('mailgun')?.configs.region, 'eu');
});
