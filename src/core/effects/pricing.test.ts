import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateCreditsForEffect } from './pricing';

test('uses the explicit model pricing schema without provider-specific fallbacks', () => {
  const estimate = estimateCreditsForEffect({
    effect: {
      id: 9,
      credit: 30,
      provider: 'beatapi',
      pricingSchema: {
        version: 1,
        strategy: 'matrix',
        fallbackCredits: 30,
        rules: [
          {
            when: { wmDuration: '5s', wmOutputQuality: '720p' },
            credits: 61,
          },
        ],
      },
    },
    input: { wmDuration: '5s', wmOutputQuality: '720p' },
  });

  assert.equal(estimate.handled, true);
  assert.equal(estimate.credits, 61);
});
