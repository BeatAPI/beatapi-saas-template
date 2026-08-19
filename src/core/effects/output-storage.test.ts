import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OUTPUT_STORAGE_SYNC_RETRY_ERROR,
  shouldRetryOutputStorageSync,
} from './output-storage';

test('retries output storage sync only after a succeeded provider result fails persistence', () => {
  assert.equal(
    shouldRetryOutputStorageSync({
      providerStatus: 'succeeded',
      output: { storage_sync_failed: true },
    }),
    true
  );
  assert.equal(
    shouldRetryOutputStorageSync({
      providerStatus: 'processing',
      output: { storage_sync_failed: true },
    }),
    false
  );
  assert.equal(
    shouldRetryOutputStorageSync({
      providerStatus: 'succeeded',
      output: { storage_sync_failed: false },
    }),
    false
  );
  assert.equal(
    OUTPUT_STORAGE_SYNC_RETRY_ERROR,
    'Output storage sync failed; waiting for retry'
  );
});
