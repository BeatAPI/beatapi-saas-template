import assert from 'node:assert/strict';
import test from 'node:test';

type SettlementDeps = {
  paymentAlreadyPaid: boolean;
  creditAlreadyGranted: boolean;
  grantCredits: () => Promise<void>;
  markPaymentCompleted: () => Promise<void>;
};

type SettlementModule = {
  settleVerifiedZpayPayment?: (deps: SettlementDeps) => Promise<boolean>;
};

const modulePath: string = './zpay-settlement';
const settlementModule = (await import(modulePath).catch(
  () => ({})
)) as SettlementModule;

test('grants credits before marking a verified ZPay payment completed', async () => {
  assert.equal(typeof settlementModule.settleVerifiedZpayPayment, 'function');

  const calls: string[] = [];
  const processed = await settlementModule.settleVerifiedZpayPayment!({
    paymentAlreadyPaid: false,
    creditAlreadyGranted: false,
    grantCredits: async () => {
      calls.push('credits');
    },
    markPaymentCompleted: async () => {
      calls.push('payment');
    },
  });

  assert.equal(processed, true);
  assert.deepEqual(calls, ['credits', 'payment']);
});

test('leaves payment retryable when credit granting fails', async () => {
  assert.equal(typeof settlementModule.settleVerifiedZpayPayment, 'function');

  let paymentMarked = false;
  await assert.rejects(
    settlementModule.settleVerifiedZpayPayment!({
      paymentAlreadyPaid: false,
      creditAlreadyGranted: false,
      grantCredits: async () => {
        throw new Error('database unavailable');
      },
      markPaymentCompleted: async () => {
        paymentMarked = true;
      },
    }),
    /database unavailable/
  );
  assert.equal(paymentMarked, false);
});

test('reconciles payment status when credits already exist', async () => {
  assert.equal(typeof settlementModule.settleVerifiedZpayPayment, 'function');

  let grants = 0;
  let paymentMarks = 0;
  const processed = await settlementModule.settleVerifiedZpayPayment!({
    paymentAlreadyPaid: false,
    creditAlreadyGranted: true,
    grantCredits: async () => {
      grants += 1;
    },
    markPaymentCompleted: async () => {
      paymentMarks += 1;
    },
  });

  assert.equal(processed, false);
  assert.equal(grants, 0);
  assert.equal(paymentMarks, 1);
});

test('does nothing when payment is already completed', async () => {
  assert.equal(typeof settlementModule.settleVerifiedZpayPayment, 'function');

  let sideEffects = 0;
  const processed = await settlementModule.settleVerifiedZpayPayment!({
    paymentAlreadyPaid: true,
    creditAlreadyGranted: true,
    grantCredits: async () => {
      sideEffects += 1;
    },
    markPaymentCompleted: async () => {
      sideEffects += 1;
    },
  });

  assert.equal(processed, false);
  assert.equal(sideEffects, 0);
});
