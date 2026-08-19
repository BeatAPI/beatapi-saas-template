export interface CreditBucketSnapshot {
  id: string;
  remainingAmount: number | null;
}

export interface CreditBucketDeduction {
  id: string;
  deductAmount: number;
  nextRemainingAmount: number;
}

export function planCreditBucketDeduction(
  buckets: readonly CreditBucketSnapshot[],
  amount: number
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }

  let remainingToDeduct = amount;
  const allocations: CreditBucketDeduction[] = [];

  for (const bucket of buckets) {
    if (remainingToDeduct <= 0) {
      break;
    }

    const remainingAmount = bucket.remainingAmount || 0;
    if (remainingAmount <= 0) {
      continue;
    }

    const deductAmount = Math.min(remainingAmount, remainingToDeduct);
    allocations.push({
      id: bucket.id,
      deductAmount,
      nextRemainingAmount: remainingAmount - deductAmount,
    });
    remainingToDeduct -= deductAmount;
  }

  return {
    allocations,
    remainingToDeduct,
  };
}
