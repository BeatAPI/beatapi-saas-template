import assert from 'node:assert/strict';
import test from 'node:test';

import { PaymentManager } from './index';
import { PaymentStatus, type PaymentProvider } from './types';

const provider = {
  name: 'stripe',
  configs: {},
  async createPayment() {
    throw new Error('not called');
  },
  async getPaymentSession() {
    return { provider: 'stripe', paymentStatus: PaymentStatus.PROCESSING };
  },
  async getPaymentEvent() {
    throw new Error('not called');
  },
} satisfies PaymentProvider;

test('an explicit unknown payment provider never falls back to the default', async () => {
  const manager = new PaymentManager();
  manager.addProvider(provider, true);

  assert.equal(manager.getProvider('paddle'), undefined);
  await assert.rejects(
    manager.getPaymentSession({ sessionId: 'session', provider: 'paddle' }),
    /Payment provider 'paddle' not found/
  );
});
