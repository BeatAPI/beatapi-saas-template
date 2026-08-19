import { getCreditBalanceFn } from '@/core/workspace-actions/get-credit-balance';
import { getCreditStatsFn } from '@/core/workspace-actions/get-credit-stats';
import { getCreditTransactionsFn } from '@/core/workspace-actions/get-credit-transactions';
import {
  keepPreviousData,
  queryOptions,
  useQuery,
} from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';

// Simple filter interface
interface SimpleFilter {
  id: string;
  value: string;
}

// Query keys
export const creditsKeys = {
  all: ['credits'] as const,
  balance: (userId: string) => [...creditsKeys.all, 'balance', userId] as const,
  stats: (userId: string) => [...creditsKeys.all, 'stats', userId] as const,
  transactions: (userId: string) =>
    [...creditsKeys.all, 'transactions', userId] as const,
  transactionsList: (
    userId: string,
    filters: {
      pageIndex: number;
      pageSize: number;
      search: string;
      sorting: SortingState;
      filters: SimpleFilter[];
    }
  ) => [...creditsKeys.transactions(userId), filters] as const,
};

export async function fetchCreditBalance() {
  const result = await getCreditBalanceFn({ data: {} });
  if (!result?.success) {
    throw new Error(result?.error || 'Failed to fetch credit balance');
  }
  return result.credits || 0;
}

export function creditBalanceQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: creditsKeys.balance(userId || ''),
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return fetchCreditBalance();
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}

// Hook to fetch credit balance
export function useCreditBalance(userId: string | undefined) {
  return useQuery(creditBalanceQueryOptions(userId));
}

// Hook to fetch credit statistics
export function useCreditStats(userId: string | undefined) {
  return useQuery({
    queryKey: creditsKeys.stats(userId || ''),
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      const result = await getCreditStatsFn({ data: {} });
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch credit stats');
      }
      return result.data;
    },
    enabled: !!userId,
  });
}

// Hook to fetch credit transactions with pagination, search, sorting, and filters
export function useCreditTransactions(
  userId: string | undefined,
  pageIndex: number,
  pageSize: number,
  search: string,
  sorting: SortingState,
  filters: SimpleFilter[]
) {
  return useQuery(
    creditTransactionsQueryOptions(
      userId,
      pageIndex,
      pageSize,
      search,
      sorting,
      filters
    )
  );
}

export async function fetchCreditTransactions(params: {
  userId: string | undefined;
  pageIndex: number;
  pageSize: number;
  search: string;
  sorting: SortingState;
  filters: SimpleFilter[];
}) {
  const { userId, pageIndex, pageSize, search, sorting, filters } = params;
  if (!userId) {
    throw new Error('User ID is required');
  }
  const result = await getCreditTransactionsFn({
    data: {
      pageIndex,
      pageSize,
      search,
      sorting,
      filters,
    },
  });

  if (!result?.success) {
    throw new Error(
      result?.error || 'Failed to fetch credit transactions'
    );
  }

  return {
    items: result.data?.items || [],
    total: result.data?.total || 0,
  };
}

export function creditTransactionsQueryOptions(
  userId: string | undefined,
  pageIndex: number,
  pageSize: number,
  search: string,
  sorting: SortingState,
  filters: SimpleFilter[]
) {
  return queryOptions({
    queryKey: creditsKeys.transactionsList(userId || '', {
      pageIndex,
      pageSize,
      search,
      sorting,
      filters,
    }),
    queryFn: async () =>
      fetchCreditTransactions({
        userId,
        pageIndex,
        pageSize,
        search,
        sorting,
        filters,
      }),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
