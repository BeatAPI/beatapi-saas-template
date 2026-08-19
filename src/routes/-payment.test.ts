import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const paymentRouteSource = await readFile(
  new URL('./payment.tsx', import.meta.url),
  'utf8'
).catch(() => '');

test('provides the payment status route used by the ZPay return URL', () => {
  assert.match(paymentRouteSource, /createFileRoute\(['"]\/payment['"]\)/);
  assert.match(paymentRouteSource, /usePaymentCompletion/);
  assert.match(paymentRouteSource, /session_id/);
});

test('keeps the payment callback on a safe same-origin path', () => {
  assert.match(paymentRouteSource, /getSafePaymentCallback/);
  assert.match(paymentRouteSource, /Routes\.History/);
  assert.match(
    paymentRouteSource,
    /window\.location\.replace\(localizeHref\(callback\)\)/
  );
});
