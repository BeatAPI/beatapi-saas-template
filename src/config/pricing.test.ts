import assert from 'node:assert/strict';
import test from 'node:test';

import { PaymentInterval, PaymentType } from '@/core/payment/types';
import { getPricingProduct } from './pricing';

test('BeatAPI monthly and annual plans are authoritative subscription products', () => {
  const monthly = getPricingProduct('beatapi_pro_monthly');
  assert.equal(monthly?.priceInCents, 7900);
  assert.equal(monthly?.currency, 'usd');
  assert.equal(monthly?.type, PaymentType.SUBSCRIPTION);
  assert.equal(monthly?.plan?.interval, PaymentInterval.MONTH);

  const yearly = getPricingProduct('beatapi_pro_yearly');
  assert.equal(yearly?.priceInCents, 66300);
  assert.equal(yearly?.plan?.interval, PaymentInterval.YEAR);
  assert.equal(yearly?.credits, 21600);
});
