import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCheckoutPath,
  getBeatAPIProductId,
  parseCheckoutIntent,
} from './checkout-intent';

test('maps every BeatAPI plan and billing period to an authoritative product id', () => {
  assert.equal(getBeatAPIProductId('starter', 'monthly'), 'beatapi_starter_monthly');
  assert.equal(getBeatAPIProductId('pro', 'yearly'), 'beatapi_pro_yearly');
  assert.equal(getBeatAPIProductId('max', 'monthly'), 'beatapi_max_monthly');
});

test('builds a checkout URL from an authoritative local product id', () => {
  assert.equal(
    buildCheckoutPath({
      productId: 'beatapi_pro_yearly',
    }),
    '/checkout?product=beatapi_pro_yearly'
  );
});

test('rejects unknown products at the checkout boundary', () => {
  assert.deepEqual(
    parseCheckoutIntent({
      product: 'made_up_plan',
    }),
    { productId: null }
  );
});
