import { randomUUID } from 'crypto';
import { websiteConfig } from '@/core/workspace-lib/website';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { creditTransaction, userCredit } from '@/config/db/schema';
import { findPlanByPlanId, findPlanByPriceId } from '@/core/workspace-lib/price-plan';
import { addDays, isAfter } from 'date-fns';
import { and, asc, eq, gt, inArray, isNull, not, or, sql } from 'drizzle-orm';
import { planCreditBucketDeduction } from './ledger';
import { CREDIT_TRANSACTION_TYPE } from './types';
import { envConfigs } from '@/config';

const usesPostgresAdvisoryLocks =
  envConfigs.database_provider === 'postgres' ||
  envConfigs.database_provider === 'postgresql';

type CreditReferenceType =
  | 'invoice'
  | 'generation'
  | 'distribution'
  | 'manual'
  | 'plan_change'
  | 'zpay_order';

export const createCreditReference = ({
  referenceType,
  referenceId,
}: {
  referenceType: CreditReferenceType;
  referenceId: string;
}) => ({
  referenceType,
  referenceId,
});

/**
 * Get user's current credit balance
 * @param userId - User ID
 * @returns User's current credit balance
 */
export async function getUserCredits(userId: string): Promise<number> {
  const db = await getDb();

  // Only a genuinely missing balance is zero. Database failures must propagate
  // so callers do not mistake an outage for an empty account.
  const record = await db
    .select({ currentCredits: userCredit.currentCredits })
    .from(userCredit)
    .where(eq(userCredit.userId, userId))
    .limit(1);

  return record[0]?.currentCredits ?? 0;
}

/**
 * Update user's current credit balance
 * @param userId - User ID
 * @param credits - New credit balance
 */
export async function updateUserCredits(userId: string, credits: number) {
  const db = await getDb();
  await db
    .update(userCredit)
    .set({ currentCredits: credits, updatedAt: new Date() })
    .where(eq(userCredit.userId, userId));
}

/**
 * Write a credit transaction record
 * @param params - Credit transaction parameters
 */
export async function saveCreditTransaction({
  userId,
  type,
  amount,
  description,
  planId,
  priceId,
  subscriptionId,
  grantMonth,
  expirationDate,
  referenceType,
  referenceId,
}: {
  userId: string;
  type: string;
  amount: number;
  description: string;
  planId?: string;
  priceId?: string;
  subscriptionId?: string;
  grantMonth?: Date;
  expirationDate?: Date;
  referenceType?: CreditReferenceType;
  referenceId?: string;
}) {
  if (!userId || !type || !description) {
    console.error(
      'saveCreditTransaction, invalid params',
      userId,
      type,
      description
    );
    throw new Error('saveCreditTransaction, invalid params');
  }
  if (!Number.isFinite(amount) || amount === 0) {
    console.error('saveCreditTransaction, invalid amount', userId, amount);
    throw new Error('saveCreditTransaction, invalid amount');
  }
  if (!!referenceType !== !!referenceId) {
    throw new Error(
      'saveCreditTransaction requires referenceType/referenceId together'
    );
  }
  const db = await getDb();
  await db.insert(creditTransaction).values({
    id: randomUUID(),
    userId,
    type,
    amount,
    // remaining amount is the same as amount for earn transactions
    // remaining amount is null for spend transactions
    remainingAmount: amount > 0 ? amount : null,
    description,
    ...(referenceType && referenceId
      ? createCreditReference({ referenceType, referenceId })
      : { referenceType: null, referenceId: null }),
    planId,
    priceId,
    subscriptionId,
    grantMonth,
    expirationDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * Add credits (registration, monthly, purchase, etc.)
 * @param params - Credit creation parameters
 */
export async function addCredits({
  userId,
  amount,
  type,
  description,
  planId,
  priceId,
  subscriptionId,
  grantMonth,
  expireDays,
  referenceType,
  referenceId,
}: {
  userId: string;
  amount: number;
  type: string;
  description: string;
  planId?: string;
  priceId?: string;
  subscriptionId?: string;
  grantMonth?: Date;
  expireDays?: number;
  referenceType?: CreditReferenceType;
  referenceId?: string;
}) {
  if (!userId || !type || !description) {
    console.error('addCredits, invalid params', userId, type, description);
    throw new Error('Invalid params');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('addCredits, invalid amount', userId, amount);
    throw new Error('Invalid amount');
  }
  if (
    expireDays !== undefined &&
    (!Number.isFinite(expireDays) || expireDays <= 0)
  ) {
    console.error('addCredits, invalid expire days', userId, expireDays);
    throw new Error('Invalid expire days');
  }
  if (!!referenceType !== !!referenceId) {
    throw new Error('addCredits requires referenceType/referenceId together');
  }
  const db = await getDb();
  await db.transaction(async (tx: any) => {
    const now = new Date();
    const expirationDate = expireDays ? addDays(now, expireDays) : undefined;

    // Serialize all credit mutations by user to eliminate race conditions.
    if (usesPostgresAdvisoryLocks) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    }

    if (referenceType && referenceId) {
      const existingReference = await tx
        .select({ id: creditTransaction.id })
        .from(creditTransaction)
        .where(
          and(
            eq(creditTransaction.userId, userId),
            eq(creditTransaction.type, type),
            eq(creditTransaction.referenceType, referenceType),
            eq(creditTransaction.referenceId, referenceId)
          )
        )
        .limit(1);

      if (existingReference.length > 0) {
        return;
      }
    }

    const creditRows = await tx
      .select({
        id: userCredit.id,
        currentCredits: userCredit.currentCredits,
      })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .orderBy(asc(userCredit.createdAt));

    if (creditRows.length === 0) {
      await tx.insert(userCredit).values({
        id: randomUUID(),
        userId,
        currentCredits: amount,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const totalBalance = creditRows.reduce(
        (sum: number, row: any) => sum + (row.currentCredits || 0),
        0
      );
      const primaryRow = creditRows[0];
      const duplicateIds = creditRows.slice(1).map((row: any) => row.id);
      const newBalance = totalBalance + amount;

      await tx
        .update(userCredit)
        .set({
          currentCredits: newBalance,
          updatedAt: now,
        })
        .where(eq(userCredit.id, primaryRow.id));

      if (duplicateIds.length > 0) {
        await tx.delete(userCredit).where(inArray(userCredit.id, duplicateIds));
      }
    }

    await tx.insert(creditTransaction).values({
      id: randomUUID(),
      userId,
      type,
      amount,
      remainingAmount: amount > 0 ? amount : null,
      description,
      ...(referenceType && referenceId
        ? createCreditReference({ referenceType, referenceId })
        : { referenceType: null, referenceId: null }),
      planId,
      priceId,
      subscriptionId,
      grantMonth,
      expirationDate,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Check if user has enough credits
 * @param userId - User ID
 * @param requiredCredits - Required credits
 */
export async function hasEnoughCredits({
  userId,
  requiredCredits,
}: {
  userId: string;
  requiredCredits: number;
}) {
  const balance = await getUserCredits(userId);
  return balance >= requiredCredits;
}

/**
 * Consume credits (FIFO, by expiration)
 * @param params - Credit consumption parameters
 */
export async function consumeCredits({
  userId,
  amount,
  description,
  referenceId,
}: {
  userId: string;
  amount: number;
  description: string;
  referenceId?: string;
}) {
  if (!userId || !description) {
    console.error('consumeCredits, invalid params', userId, description);
    throw new Error('Invalid params');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('consumeCredits, invalid amount', userId, amount);
    throw new Error('Invalid amount');
  }
  const db = await getDb();
  await db.transaction(async (tx: any) => {
    const now = new Date();

    // Serialize all credit mutations by user to eliminate race conditions.
    if (usesPostgresAdvisoryLocks) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    }

    // Idempotent guard: avoid duplicate deduction for the same generation/reference.
    if (referenceId) {
      const usageExists = await tx
        .select({ id: creditTransaction.id })
        .from(creditTransaction)
        .where(
          and(
            eq(creditTransaction.userId, userId),
            eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.USAGE),
            eq(creditTransaction.referenceType, 'generation'),
            eq(creditTransaction.referenceId, referenceId)
          )
        )
        .limit(1);

      if (usageExists.length > 0) {
        return;
      }
    }

    const creditRows = await tx
      .select({
        id: userCredit.id,
        currentCredits: userCredit.currentCredits,
      })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .orderBy(asc(userCredit.createdAt));

    const currentBalance = creditRows.reduce(
      (sum: number, row: any) => sum + (row.currentCredits || 0),
      0
    );
    if (currentBalance < amount) {
      console.error(
        `consumeCredits, insufficient credits for user ${userId}, required: ${amount}, current: ${currentBalance}`
      );
      throw new Error('Insufficient credits');
    }

    const transactions = await tx
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.USAGE)),
          not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.EXPIRE)),
          gt(creditTransaction.remainingAmount, 0),
          or(
            isNull(creditTransaction.expirationDate),
            gt(creditTransaction.expirationDate, now)
          )
        )
      )
      .orderBy(
        asc(creditTransaction.expirationDate),
        asc(creditTransaction.createdAt)
      );

    const deductionPlan = planCreditBucketDeduction(transactions, amount);

    for (const allocation of deductionPlan.allocations) {
      await tx
        .update(creditTransaction)
        .set({
          remainingAmount: allocation.nextRemainingAmount,
          updatedAt: now,
        })
        .where(eq(creditTransaction.id, allocation.id));
    }

    if (deductionPlan.remainingToDeduct > 0) {
      throw new Error('Insufficient credits');
    }

    const nextBalance = currentBalance - amount;
    if (creditRows.length === 0) {
      await tx.insert(userCredit).values({
        id: randomUUID(),
        userId,
        currentCredits: nextBalance,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const primaryRow = creditRows[0];
      const duplicateIds = creditRows.slice(1).map((row: any) => row.id);
      await tx
        .update(userCredit)
        .set({ currentCredits: nextBalance, updatedAt: now })
        .where(eq(userCredit.id, primaryRow.id));

      if (duplicateIds.length > 0) {
        await tx.delete(userCredit).where(inArray(userCredit.id, duplicateIds));
      }
    }

    await tx.insert(creditTransaction).values({
      id: randomUUID(),
      userId,
      type: CREDIT_TRANSACTION_TYPE.USAGE,
      amount: -amount,
      remainingAmount: null,
      description,
      ...(referenceId
        ? createCreditReference({
            referenceType: 'generation',
            referenceId,
          })
        : { referenceType: null, referenceId: null }),
      createdAt: now,
      updatedAt: now,
    });
  });
}

export async function reserveCredits({
  userId,
  amount,
  description,
  referenceId,
}: {
  userId: string;
  amount: number;
  description: string;
  referenceId: string;
}) {
  if (!referenceId) {
    throw new Error('Invalid referenceId');
  }

  const db = await getDb();
  await db.transaction(async (tx: any) => {
    const now = new Date();
    if (usesPostgresAdvisoryLocks) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    }

    const existing = await tx
      .select({
        id: creditTransaction.id,
        type: creditTransaction.type,
      })
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          eq(creditTransaction.referenceType, 'generation'),
          eq(creditTransaction.referenceId, referenceId),
          inArray(creditTransaction.type, [
            CREDIT_TRANSACTION_TYPE.RESERVE,
            CREDIT_TRANSACTION_TYPE.USAGE,
          ])
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    const creditRows = await tx
      .select({
        id: userCredit.id,
        currentCredits: userCredit.currentCredits,
      })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .orderBy(asc(userCredit.createdAt));

    const currentBalance = creditRows.reduce(
      (sum: number, row: any) => sum + (row.currentCredits || 0),
      0
    );

    if (currentBalance < amount) {
      throw new Error('Insufficient credits');
    }

    const transactions = await tx
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.USAGE)),
          not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.EXPIRE)),
          gt(creditTransaction.remainingAmount, 0),
          or(
            isNull(creditTransaction.expirationDate),
            gt(creditTransaction.expirationDate, now)
          )
        )
      )
      .orderBy(
        asc(creditTransaction.expirationDate),
        asc(creditTransaction.createdAt)
      );

    const deductionPlan = planCreditBucketDeduction(transactions, amount);
    if (deductionPlan.remainingToDeduct > 0) {
      throw new Error('Insufficient credits');
    }

    for (const allocation of deductionPlan.allocations) {
      await tx
        .update(creditTransaction)
        .set({
          remainingAmount: allocation.nextRemainingAmount,
          updatedAt: now,
        })
        .where(eq(creditTransaction.id, allocation.id));
    }

    const nextBalance = currentBalance - amount;
    if (creditRows.length === 0) {
      await tx.insert(userCredit).values({
        id: randomUUID(),
        userId,
        currentCredits: nextBalance,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const primaryRow = creditRows[0];
      const duplicateIds = creditRows.slice(1).map((row: any) => row.id);

      await tx
        .update(userCredit)
        .set({ currentCredits: nextBalance, updatedAt: now })
        .where(eq(userCredit.id, primaryRow.id));

      if (duplicateIds.length > 0) {
        await tx.delete(userCredit).where(inArray(userCredit.id, duplicateIds));
      }
    }

    await tx.insert(creditTransaction).values({
      id: randomUUID(),
      userId,
      type: CREDIT_TRANSACTION_TYPE.RESERVE,
      amount: -amount,
      remainingAmount: null,
      description,
      ...createCreditReference({
        referenceType: 'generation',
        referenceId,
      }),
      createdAt: now,
      updatedAt: now,
    });
  });
}

export async function confirmReservedCredits({
  userId,
  referenceId,
  description,
}: {
  userId: string;
  referenceId: string;
  description: string;
}) {
  const db = await getDb();
  await db.transaction(async (tx: any) => {
    const now = new Date();
    if (usesPostgresAdvisoryLocks) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    }

    const existingUsage = await tx
      .select({ id: creditTransaction.id })
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          eq(creditTransaction.referenceType, 'generation'),
          eq(creditTransaction.referenceId, referenceId),
          eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.USAGE)
        )
      )
      .limit(1);

    if (existingUsage.length > 0) {
      return;
    }

    const reservation = await tx
      .select({ id: creditTransaction.id })
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          eq(creditTransaction.referenceType, 'generation'),
          eq(creditTransaction.referenceId, referenceId),
          eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.RESERVE)
        )
      )
      .limit(1);

    if (reservation.length === 0) {
      throw new Error('Reserved credits not found');
    }

    await tx
      .update(creditTransaction)
      .set({
        type: CREDIT_TRANSACTION_TYPE.USAGE,
        description,
        updatedAt: now,
      })
      .where(eq(creditTransaction.id, reservation[0].id));
  });
}

export async function releaseReservedCredits({
  userId,
  referenceId,
  description,
}: {
  userId: string;
  referenceId: string;
  description: string;
}) {
  const db = await getDb();
  await db.transaction(async (tx: any) => {
    const now = new Date();
    if (usesPostgresAdvisoryLocks) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    }

    const existingRelease = await tx
      .select({ id: creditTransaction.id })
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          eq(creditTransaction.referenceType, 'generation'),
          eq(creditTransaction.referenceId, referenceId),
          eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.RELEASE)
        )
      )
      .limit(1);

    if (existingRelease.length > 0) {
      return;
    }

    const reservation = await tx
      .select({
        id: creditTransaction.id,
        amount: creditTransaction.amount,
      })
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          eq(creditTransaction.referenceType, 'generation'),
          eq(creditTransaction.referenceId, referenceId),
          eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.RESERVE)
        )
      )
      .limit(1);

    if (reservation.length === 0) {
      return;
    }

    const releaseAmount = Math.abs(reservation[0].amount);
    const creditRows = await tx
      .select({
        id: userCredit.id,
        currentCredits: userCredit.currentCredits,
      })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .orderBy(asc(userCredit.createdAt));

    const currentBalance = creditRows.reduce(
      (sum: number, row: any) => sum + (row.currentCredits || 0),
      0
    );
    const nextBalance = currentBalance + releaseAmount;

    if (creditRows.length === 0) {
      await tx.insert(userCredit).values({
        id: randomUUID(),
        userId,
        currentCredits: nextBalance,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const primaryRow = creditRows[0];
      const duplicateIds = creditRows.slice(1).map((row: any) => row.id);

      await tx
        .update(userCredit)
        .set({ currentCredits: nextBalance, updatedAt: now })
        .where(eq(userCredit.id, primaryRow.id));

      if (duplicateIds.length > 0) {
        await tx.delete(userCredit).where(inArray(userCredit.id, duplicateIds));
      }
    }

    await tx.insert(creditTransaction).values({
      id: randomUUID(),
      userId,
      type: CREDIT_TRANSACTION_TYPE.RELEASE,
      amount: releaseAmount,
      remainingAmount: releaseAmount,
      description,
      ...createCreditReference({
        referenceType: 'generation',
        referenceId,
      }),
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Refund consumed credits back to user account
 */
export async function refundCredits({
  userId,
  amount,
  description,
  referenceId,
}: {
  userId: string;
  amount: number;
  description: string;
  referenceId?: string;
}) {
  if (!userId || !description) {
    throw new Error('Invalid params');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }

  if (!referenceId) {
    await addCredits({
      userId,
      amount,
      type: CREDIT_TRANSACTION_TYPE.REFUND,
      description,
    });
    return;
  }

  const db = await getDb();
  await db.transaction(async (tx: any) => {
    const now = new Date();
    if (usesPostgresAdvisoryLocks) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    }

    const existingRefund = await tx
      .select({ id: creditTransaction.id })
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.REFUND),
          eq(creditTransaction.referenceType, 'generation'),
          eq(creditTransaction.referenceId, referenceId)
        )
      )
      .limit(1);

    if (existingRefund.length > 0) {
      return;
    }

    const creditRows = await tx
      .select({
        id: userCredit.id,
        currentCredits: userCredit.currentCredits,
      })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .orderBy(asc(userCredit.createdAt));

    const currentBalance = creditRows.reduce(
      (sum: number, row: any) => sum + (row.currentCredits || 0),
      0
    );
    const nextBalance = currentBalance + amount;

    if (creditRows.length === 0) {
      await tx.insert(userCredit).values({
        id: randomUUID(),
        userId,
        currentCredits: nextBalance,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const primaryRow = creditRows[0];
      const duplicateIds = creditRows.slice(1).map((row: any) => row.id);

      await tx
        .update(userCredit)
        .set({ currentCredits: nextBalance, updatedAt: now })
        .where(eq(userCredit.id, primaryRow.id));

      if (duplicateIds.length > 0) {
        await tx.delete(userCredit).where(inArray(userCredit.id, duplicateIds));
      }
    }

    await tx.insert(creditTransaction).values({
      id: randomUUID(),
      userId,
      type: CREDIT_TRANSACTION_TYPE.REFUND,
      amount,
      remainingAmount: amount,
      description,
      ...createCreditReference({
        referenceType: 'generation',
        referenceId,
      }),
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Process expired credits
 * @param userId - User ID
 * @deprecated This function is no longer used, see distribute.ts instead
 */
export async function processExpiredCredits(userId: string) {
  const now = new Date();
  // Get all credit transactions that can expire (have expirationDate and not yet processed)
  const db = await getDb();
  const transactions = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        // Exclude usage and expire records (these are consumption/expiration logs)
        not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.USAGE)),
        not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.EXPIRE)),
        // Only include transactions with expirationDate set
        not(isNull(creditTransaction.expirationDate)),
        // Only include transactions not yet processed for expiration
        isNull(creditTransaction.expirationDateProcessedAt),
        // Only include transactions with remaining amount > 0
        gt(creditTransaction.remainingAmount, 0)
      )
    );
  let expiredTotal = 0;
  // Process expired credit transactions
  for (const transaction of transactions) {
    if (
      transaction.expirationDate &&
      isAfter(now, transaction.expirationDate) &&
      !transaction.expirationDateProcessedAt
    ) {
      const remain = transaction.remainingAmount || 0;
      if (remain > 0) {
        expiredTotal += remain;
        await db
          .update(creditTransaction)
          .set({
            remainingAmount: 0,
            expirationDateProcessedAt: now,
            updatedAt: now,
          })
          .where(eq(creditTransaction.id, transaction.id));
      }
    }
  }
  if (expiredTotal > 0) {
    // Deduct expired credits from balance
    const current = await db
      .select()
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .limit(1);
    const newBalance = Math.max(
      0,
      (current[0]?.currentCredits || 0) - expiredTotal
    );
    await db
      .update(userCredit)
      .set({ currentCredits: newBalance, updatedAt: now })
      .where(eq(userCredit.userId, userId));
    // Write expire record
    await saveCreditTransaction({
      userId,
      type: CREDIT_TRANSACTION_TYPE.EXPIRE,
      amount: -expiredTotal,
      description: `Expire credits: ${expiredTotal}`,
    });

    console.log(
      `processExpiredCredits, ${expiredTotal} credits expired for user ${userId}`
    );
  }
}

/**
 * Check if specific type of credits can be added for a user based on transaction history
 * @param userId - User ID
 * @param creditType - Type of credit transaction to check
 */
export async function canAddCreditsByType(userId: string, creditType: string) {
  const db = await getDb();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Check if user has already received this type of credits this month
  const existingTransaction = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(creditTransaction.type, creditType),
        // Check if transaction was created in the current month and year
        sql`EXTRACT(MONTH FROM ${creditTransaction.createdAt}) = ${currentMonth + 1}`,
        sql`EXTRACT(YEAR FROM ${creditTransaction.createdAt}) = ${currentYear}`
      )
    )
    .limit(1);

  return existingTransaction.length === 0;
}

function getCurrentMonthBucket(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Check if subscription credits can be added for a specific plan in the current month.
 * Rule: same plan can only receive subscription credits once per month.
 */
export async function canAddSubscriptionCreditsByPlan(
  userId: string,
  planId: string,
  planName?: string
) {
  const db = await getDb();
  const currentMonthBucket = getCurrentMonthBucket();

  const legacyDescriptionCondition = planName
    ? or(
        eq(creditTransaction.description, `Monthly ${planName} Plan`),
        eq(creditTransaction.description, `Yearly ${planName} Plan`)
      )
    : undefined;

  const existingTransaction = await db
    .select({ id: creditTransaction.id })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(
          creditTransaction.type,
          CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_RENEWAL
        ),
        or(
          eq(creditTransaction.grantMonth, currentMonthBucket),
          and(
            isNull(creditTransaction.grantMonth),
            sql`EXTRACT(MONTH FROM ${creditTransaction.createdAt}) = ${currentMonthBucket.getMonth() + 1}`,
            sql`EXTRACT(YEAR FROM ${creditTransaction.createdAt}) = ${currentMonthBucket.getFullYear()}`
          )
        ),
        legacyDescriptionCondition
          ? or(
              eq(creditTransaction.planId, planId),
              and(isNull(creditTransaction.planId), legacyDescriptionCondition)
            )
          : eq(creditTransaction.planId, planId)
      )
    )
    .limit(1);

  return existingTransaction.length === 0;
}

/**
 * Check if subscription credits can be added for a user based on last refresh time
 * @param userId - User ID
 */

/**
 * Add register gift credits
 * @param userId - User ID
 */
export async function addRegisterGiftCredits(
  userId: string,
  options?: { amount?: number; expireDays?: number }
) {
  // Check if user has already received register gift credits
  const db = await getDb();
  const record = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.REGISTER_GIFT)
      )
    )
    .limit(1);

  // add register gift credits if user has not received them yet
  if (record.length === 0) {
    const credits =
      options?.amount ?? websiteConfig.credits.registerGiftCredits.amount;
    const expireDays =
      options?.expireDays ?? websiteConfig.credits.registerGiftCredits.expireDays;
    await addCredits({
      userId,
      amount: credits,
      type: CREDIT_TRANSACTION_TYPE.REGISTER_GIFT,
      description: `Register gift credits: ${credits}`,
      expireDays,
    });

    console.log(
      `addRegisterGiftCredits, ${credits} credits for user ${userId}`
    );
  }
}

/**
 * Add free monthly credits
 * @param userId - User ID
 * @param planId - Plan ID
 */
export async function addMonthlyFreeCredits(userId: string, planId: string) {
  // NOTICE: make sure the free plan is not disabled and has credits enabled
  const pricePlan = findPlanByPlanId(planId);
  if (
    !pricePlan ||
    pricePlan.disabled ||
    !pricePlan.isFree ||
    !pricePlan.credits ||
    !pricePlan.credits.enable
  ) {
    console.log(
      `addMonthlyFreeCredits, no credits configured for plan ${planId}`
    );
    return;
  }

  const canAdd = await canAddCreditsByType(
    userId,
    CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH
  );
  const now = new Date();

  // add credits if it's a new month
  if (canAdd) {
    const credits = pricePlan.credits?.amount || 0;
    const expireDays = pricePlan.credits?.expireDays || 0;
    await addCredits({
      userId,
      amount: credits,
      type: CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH,
      description: `Free monthly credits: ${credits} for ${now.getFullYear()}-${now.getMonth() + 1}`,
      expireDays,
    });

    console.log(
      `addMonthlyFreeCredits, ${credits} credits for user ${userId}, date: ${now.getFullYear()}-${now.getMonth() + 1}`
    );
  } else {
    console.log(
      `addMonthlyFreeCredits, no new month for user ${userId}, date: ${now.getFullYear()}-${now.getMonth() + 1}`
    );
  }
}

/**
 * Add subscription credits
 * @param userId - User ID
 * @param priceId - Price ID
 * @param invoiceId - Stripe invoice ID, used for idempotent deduplication
 */
export async function addSubscriptionCredits(
  userId: string,
  priceId: string,
  invoiceId: string,
  subscriptionId?: string
) {
  if (!invoiceId) {
    throw new Error('addSubscriptionCredits requires invoiceId');
  }

  // NOTICE: the price plan maybe disabled, but we still need to add credits for existing users
  const pricePlan = findPlanByPriceId(priceId);
  if (
    !pricePlan ||
    // pricePlan.disabled ||
    !pricePlan.credits ||
    !pricePlan.credits.enable
  ) {
    console.log(
      `addSubscriptionCredits, no credits configured for plan ${priceId}`
    );
    return;
  }

  const now = new Date();

  // Prefer invoice-level deduplication so multiple subscriptions in one month can all grant credits.
  const db = await getDb();
  const exists = await db
    .select({ id: creditTransaction.id })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(
          creditTransaction.type,
          CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_RENEWAL
        ),
        eq(creditTransaction.referenceType, 'invoice'),
        eq(creditTransaction.referenceId, invoiceId)
      )
    )
    .limit(1);

  if (exists.length > 0) {
    console.log(
      `addSubscriptionCredits, invoice already processed for user ${userId}, invoiceId: ${invoiceId}`
    );
    return;
  }

  const credits = pricePlan.credits.amount;
  const planName = pricePlan.name || pricePlan.id;
  const planId = pricePlan.id;
  const matchedPrice = pricePlan.prices.find(
    (price) => price.priceId === priceId
  );
  const intervalLabel =
    matchedPrice?.interval === 'year' ? 'Yearly' : 'Monthly';

  const canAddForPlan = await canAddSubscriptionCreditsByPlan(
    userId,
    planId,
    planName
  );
  if (!canAddForPlan) {
    console.log(
      `addSubscriptionCredits, same plan already credited this month for user ${userId}, plan: ${planName}`
    );
    return;
  }

  await addCredits({
    userId,
    amount: credits,
    type: CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_RENEWAL,
    description: `${intervalLabel} ${planName} Plan`,
    referenceType: 'invoice',
    referenceId: invoiceId,
    planId,
    priceId,
    subscriptionId,
    grantMonth: getCurrentMonthBucket(now),
    expireDays: undefined,
  });

  console.log(
    `addSubscriptionCredits, ${credits} credits for user ${userId}, priceId: ${priceId}, invoiceId: ${invoiceId ?? 'N/A'}, date: ${now.getFullYear()}-${now.getMonth() + 1}`
  );
}

export async function addPlanChangeCredits(
  userId: string,
  priceId: string,
  referenceId: string,
  subscriptionId?: string,
  grantedAt = new Date()
) {
  const pricePlan = findPlanByPriceId(priceId);
  if (!pricePlan || !pricePlan.credits || !pricePlan.credits.enable) {
    console.log(
      `addPlanChangeCredits, no credits configured for plan ${priceId}`
    );
    return;
  }

  const db = await getDb();
  const existing = await db
    .select({ id: creditTransaction.id })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(
          creditTransaction.type,
          CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_PLAN_CHANGE
        ),
        eq(creditTransaction.referenceType, 'plan_change'),
        eq(creditTransaction.referenceId, referenceId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(
      `addPlanChangeCredits, reference already processed for user ${userId}, referenceId: ${referenceId}`
    );
    return;
  }

  const matchedPrice = pricePlan.prices.find(
    (price) => price.priceId === priceId
  );
  const intervalLabel =
    matchedPrice?.interval === 'year' ? 'Yearly' : 'Monthly';

  await addCredits({
    userId,
    amount: pricePlan.credits.amount,
    type: CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_PLAN_CHANGE,
    description: `${intervalLabel} ${pricePlan.name || pricePlan.id} Plan Upgrade`,
    planId: pricePlan.id,
    priceId,
    subscriptionId,
    grantMonth: getCurrentMonthBucket(grantedAt),
    referenceType: 'plan_change',
    referenceId,
    expireDays: undefined,
  });

  console.log(
    `addPlanChangeCredits, ${pricePlan.credits.amount} credits for user ${userId}, priceId: ${priceId}, referenceId: ${referenceId}`
  );
}

/**
 * Add lifetime monthly credits
 * @param userId - User ID
 * @param priceId - Price ID
 */
export async function addLifetimeMonthlyCredits(
  userId: string,
  priceId: string
) {
  // NOTICE: make sure the lifetime plan is not disabled and has credits enabled
  const pricePlan = findPlanByPriceId(priceId);
  if (
    !pricePlan ||
    !pricePlan.isLifetime ||
    pricePlan.disabled ||
    !pricePlan.credits ||
    !pricePlan.credits.enable
  ) {
    console.log(
      `addLifetimeMonthlyCredits, no credits configured for plan ${priceId}`
    );
    return;
  }

  const canAdd = await canAddCreditsByType(
    userId,
    CREDIT_TRANSACTION_TYPE.LIFETIME_MONTHLY
  );
  const now = new Date();

  // Add credits if it's a new month
  if (canAdd) {
    const credits = pricePlan.credits.amount;
    const expireDays = pricePlan.credits.expireDays;

    await addCredits({
      userId,
      amount: credits,
      type: CREDIT_TRANSACTION_TYPE.LIFETIME_MONTHLY,
      description: `Lifetime monthly credits: ${credits} for ${now.getFullYear()}-${now.getMonth() + 1}`,
      expireDays,
    });

    console.log(
      `addLifetimeMonthlyCredits, ${credits} credits for user ${userId}, date: ${now.getFullYear()}-${now.getMonth() + 1}`
    );
  } else {
    console.log(
      `addLifetimeMonthlyCredits, no new month for user ${userId}, date: ${now.getFullYear()}-${now.getMonth() + 1}`
    );
  }
}
