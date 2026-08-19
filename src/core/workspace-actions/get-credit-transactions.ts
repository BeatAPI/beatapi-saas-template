import { createServerFn } from '@tanstack/react-start';
import { CREDIT_TRANSACTION_TYPE } from '@/core/workspace-credits/types';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { creditTransaction, effect, generationHistory } from '@/config/db/schema';
import {
  formatGenerationDescription,
  formatGenerationModelParams,
} from '@/core/workspace-lib/credit-transaction-display';
import { requireSession } from '@/core/workspace-lib/session';
import {
  and,
  asc,
  count as countFn,
  desc,
  eq,
  ilike,
  inArray,
  or,
} from 'drizzle-orm';
import { z } from 'zod';

// Define the schema for getCreditTransactions parameters
const getCreditTransactionsSchema = z.object({
  pageIndex: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(100).default(10),
  search: z.string().optional().default(''),
  sorting: z
    .array(
      z.object({
        id: z.string(),
        desc: z.boolean(),
      })
    )
    .optional()
    .default([]),
  filters: z
    .array(
      z.object({
        id: z.string(),
        value: z.string(),
      })
    )
    .optional()
    .default([]),
});

// Define sort field mapping
const sortFieldMap = {
  type: creditTransaction.type,
  amount: creditTransaction.amount,
  description: creditTransaction.description,
  createdAt: creditTransaction.createdAt,
} as const;

const formatSubscriptionDescription = (description: string | null) => {
  if (!description) {
    return 'Subscription Renewal';
  }

  const directMatch = description.match(/^(Monthly|Yearly)\s+(.+?)\s+Plan$/i);
  if (directMatch) {
    const interval =
      directMatch[1].toLowerCase() === 'yearly' ? 'Yearly' : 'Monthly';
    return `${interval} ${directMatch[2]} Plan`;
  }

  const legacyMatch = description.match(/Subscription renewal\s*\(([^)]+)\)/i);
  if (legacyMatch) {
    return `Monthly ${legacyMatch[1]} Plan`;
  }

  return description;
};

const formatPlanChangeDescription = (description: string | null) => {
  if (!description) {
    return 'Plan Upgrade';
  }

  const directMatch = description.match(
    /^(Monthly|Yearly)\s+(.+?)\s+Plan Upgrade$/i
  );
  if (directMatch) {
    const interval =
      directMatch[1].toLowerCase() === 'yearly' ? 'Yearly' : 'Monthly';
    return `${interval} ${directMatch[2]} Plan Upgrade`;
  }

  return description;
};

/**
 * Get paginated credit transactions for the current user.
 *
 * Migrated from BeatAPI's next-safe-action `getCreditTransactionsAction`.
 * Returns { success, data: { items, total } } directly.
 * Hooks call with a bare object: getCreditTransactionsFn({ data: {...} }).
 */
export const getCreditTransactionsFn = createServerFn()
  .inputValidator(getCreditTransactionsSchema)
  .handler(async ({ data }) => {
    try {
      const { pageIndex, pageSize, search, sorting, filters } = data;
      const session = await requireSession();

      // Build where conditions
      const whereConditions = [eq(creditTransaction.userId, session.user.id)];

      // Search logic
      if (search) {
        const searchConditions = [];
        searchConditions.push(
          ilike(creditTransaction.type, `%${search}%`),
          ilike(creditTransaction.referenceId, `%${search}%`),
          ilike(creditTransaction.description, `%${search}%`)
        );

        const numericSearch = Number.parseInt(search, 10);
        if (!Number.isNaN(numericSearch)) {
          searchConditions.push(
            eq(creditTransaction.amount, numericSearch),
            eq(creditTransaction.remainingAmount, numericSearch)
          );
        }

        if (searchConditions.length > 1) {
          const orCondition = or(...searchConditions);
          if (orCondition) {
            whereConditions.push(orCondition);
          }
        } else if (searchConditions.length === 1) {
          whereConditions.push(searchConditions[0]);
        }
      }

      // Apply filters (independent of search)
      for (const filter of filters) {
        if (filter.id === 'type' && filter.value) {
          whereConditions.push(eq(creditTransaction.type, filter.value));
        }
      }

      const where = and(...whereConditions);
      const offset = pageIndex * pageSize;

      // Get the sort configuration
      const sortConfig = sorting[0];
      const sortField = sortConfig?.id
        ? sortFieldMap[sortConfig.id as keyof typeof sortFieldMap]
        : creditTransaction.createdAt;
      const sortDirection = sortConfig?.desc ? desc : asc;

      const db = await getDb();
      const baseItemsQuery = db
        .select({
          id: creditTransaction.id,
          userId: creditTransaction.userId,
          type: creditTransaction.type,
          description: creditTransaction.description,
          amount: creditTransaction.amount,
          referenceType: creditTransaction.referenceType,
          referenceId: creditTransaction.referenceId,
          createdAt: creditTransaction.createdAt,
        })
        .from(creditTransaction)
        .where(where)
        .orderBy(sortDirection(sortField))
        .limit(pageSize)
        .offset(offset);
      const countQuery = db
        .select({ count: countFn() })
        .from(creditTransaction)
        .where(where);

      const [baseItems, [{ count }]] = (await Promise.all([
        baseItemsQuery,
        countQuery,
      ])) as [
        {
          id: string;
          userId: string;
          type: string;
          description: string | null;
          amount: number;
          referenceType: string | null;
          referenceId: string | null;
          createdAt: Date;
        }[],
        { count: number }[],
      ];

      const generationIds = baseItems
        .filter(
          (item) =>
            item.type === 'USAGE' &&
            item.referenceType === 'generation' &&
            typeof item.referenceId === 'string' &&
            item.referenceId.length > 0
        )
        .map((item) => item.referenceId as string);

      let generationMap = new Map<
        string,
        {
          status: string;
          modelParams: string | null;
          effectName: string | null;
          effectModel: string | null;
          effectType: number | null;
          input: unknown;
        }
      >();

      if (generationIds.length > 0) {
        const generations = (await db
          .select({
            id: generationHistory.id,
            status: generationHistory.status,
            input: generationHistory.input,
            effectName: effect.name,
            effectModel: effect.model,
            effectType: effect.type,
          })
          .from(generationHistory)
          .leftJoin(effect, eq(effect.id, generationHistory.effectId))
          .where(inArray(generationHistory.id, generationIds))) as {
          id: string;
          status: string;
          input: unknown;
          effectName: string | null;
          effectModel: string | null;
          effectType: number | null;
        }[];

        generationMap = new Map(
          generations.map((item) => [
            item.id,
            {
              status: item.status,
              modelParams: formatGenerationModelParams({
                input: item.input,
                effectName: item.effectName ?? null,
                effectModel: item.effectModel ?? null,
              }),
              effectName: item.effectName ?? null,
              effectModel: item.effectModel ?? null,
              effectType: item.effectType ?? null,
              input: item.input,
            },
          ])
        );
      }

      const items = baseItems.map((item) => {
        if (
          item.type !== 'USAGE' ||
          item.referenceType !== 'generation' ||
          !item.referenceId
        ) {
          return {
            ...item,
            description:
              item.type === CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_RENEWAL
                ? formatSubscriptionDescription(item.description)
                : item.type === CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_PLAN_CHANGE
                  ? formatPlanChangeDescription(item.description)
                  : item.description,
            expirationDate: null,
            modelParams: null,
            generationStatus: null,
          };
        }

        const generation = generationMap.get(item.referenceId);
        const friendlyDescription = formatGenerationDescription({
          input: generation?.input,
          effectName: generation?.effectName ?? null,
          effectType: generation?.effectType ?? null,
          fallback: item.description,
        });

        return {
          ...item,
          description: friendlyDescription,
          expirationDate: null,
          modelParams: generation?.modelParams ?? null,
          generationStatus: generation?.status ?? null,
        };
      });

      return {
        success: true as const,
        data: {
          items,
          total: Number(count),
        },
      };
    } catch (error) {
      console.error('get credit transactions error:', error);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch credit transactions',
      };
    }
  });
