import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePaymentCatalog, resolveProviderProductId } from './provider-catalog';

test('optional payment providers resolve external catalog IDs', () => {
  const configs = {
    payment_catalog_json: JSON.stringify({
      starter_monthly: {
        lemonsqueezy: '123456',
        paddle: 'pri_test',
      },
    }),
  };

  assert.equal(
    resolveProviderProductId({
      localProductId: 'starter_monthly',
      provider: 'lemonsqueezy',
      configs,
    }),
    '123456'
  );
  assert.equal(
    resolveProviderProductId({
      localProductId: 'starter_monthly',
      provider: 'paddle',
      configs,
    }),
    'pri_test'
  );
});

test('Stripe keeps dynamic pricing and optional providers fail when unmapped', () => {
  assert.equal(
    resolveProviderProductId({
      localProductId: 'starter_monthly',
      provider: 'stripe',
      configs: {},
    }),
    undefined
  );
  assert.throws(
    () =>
      resolveProviderProductId({
        localProductId: 'starter_monthly',
        provider: 'paddle',
        configs: { payment_catalog_json: '{}' },
      }),
    /Missing PAYMENT_CATALOG_JSON mapping/
  );
  assert.throws(() => parsePaymentCatalog('{broken'), /must be valid JSON/);
});
