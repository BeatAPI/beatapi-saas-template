import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPaymentManager,
  getConfiguredPaymentProviderNames,
  paymentManagerConfigFingerprint,
} from './provider-config';

const configs = {
  default_payment_provider: 'paddle',
  lemonsqueezy_enabled: 'true',
  lemonsqueezy_api_key: 'ls_test',
  lemonsqueezy_store_id: 'store_1',
  lemonsqueezy_signing_secret: 'secret',
  lemonsqueezy_test_mode: 'true',
  paddle_enabled: 'true',
  paddle_api_key: 'pdl_test',
  paddle_webhook_secret: 'pdl_secret',
  paddle_environment: 'sandbox',
};

test('Lemon Squeezy and Paddle join the optional provider registry', () => {
  assert.deepEqual(getConfiguredPaymentProviderNames(configs), [
    'lemonsqueezy',
    'paddle',
  ]);

  const manager = buildPaymentManager(configs);
  assert.deepEqual(manager.getProviderNames(), ['lemonsqueezy', 'paddle']);
  assert.equal(manager.getDefaultProvider()?.name, 'paddle');
});

test('provider fingerprints change when optional provider secrets change', () => {
  assert.notEqual(
    paymentManagerConfigFingerprint(configs),
    paymentManagerConfigFingerprint({ ...configs, paddle_webhook_secret: 'rotated' })
  );
});
