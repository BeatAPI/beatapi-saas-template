import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateCreditsForEffect } from './pricing';

test('estimates ecommerce video credits by duration at 20 credits per second', () => {
  const estimate = (wmDuration: string) =>
    estimateCreditsForEffect({
      effect: {
        id: 15,
        credit: 5,
        provider: null,
        pricingSchema: null,
      },
      input: {
        wmDuration,
      },
    });

  assert.equal(estimate('10s').handled, true);
  assert.equal(estimate('10s').credits, 200);
  assert.equal(estimate('15s').credits, 300);
  assert.equal(estimate('60s').credits, 1200);
});
