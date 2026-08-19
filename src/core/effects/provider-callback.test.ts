import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { verifyViduCallbackSignature } from './provider-callback';

test('verifies Vidu callback signatures with signed header name casing preserved', () => {
  const secret = 'test-vidu-callback-secret';
  const date = 'Tue, 06 May 2025 12:00:00 GMT';
  const nonce = 'nonce-123';
  const stringToSign = [
    'POST',
    '/api/effects/callback',
    '',
    'vidu',
    date,
    `Date:${date}`,
    `x-request-nonce:${nonce}`,
    '',
  ].join('\n');
  const signature = createHmac('sha256', secret)
    .update(stringToSign)
    .digest('base64');

  const result = verifyViduCallbackSignature({
    method: 'POST',
    callbackUri: '/api/effects/callback',
    rawQueryString: '',
    headers: new Headers({
      Date: date,
      'x-request-nonce': nonce,
      'X-HMAC-SIGNED-HEADERS': 'Date;x-request-nonce',
      'X-HMAC-SIGNATURE': signature,
      'X-HMAC-ALGORITHM': 'hmac-sha256',
      'X-HMAC-ACCESS-KEY': 'vidu',
    }),
    secret,
    nowMs: Date.parse(date),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.nonce, nonce);
  }
});
