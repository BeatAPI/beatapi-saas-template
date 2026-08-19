import assert from 'node:assert/strict';
import test from 'node:test';
import { isGenericPaymentCheckoutEnabled } from './checkout-availability';

test('generic payment checkout is opt-in and disabled by default', () => {
  assert.equal(isGenericPaymentCheckoutEnabled({}), false);
  assert.equal(
    isGenericPaymentCheckoutEnabled({ generic_payment_enabled: 'false' }),
    false
  );
  assert.equal(
    isGenericPaymentCheckoutEnabled({ generic_payment_enabled: 'true' }),
    true
  );
});

test('configured SaaS payment providers make checkout available without a hidden flag', () => {
  assert.equal(
    isGenericPaymentCheckoutEnabled({
      stripe_enabled: 'true',
      stripe_secret_key: 'sk_test_example',
    }),
    true
  );
  assert.equal(
    isGenericPaymentCheckoutEnabled({
      paypal_enabled: 'true',
      paypal_client_id: 'client',
      paypal_client_secret: 'secret',
    }),
    true
  );
});
