import type {
  GameConfig,
  HistoryItem,
  LeaderboardResponse,
  MeResponse,
  Page,
  ProfileResponse,
  RewardsResponse,
  TransactionFilter,
  TransactionItem,
  WalletResponse,
} from '@casino/shared';
import { MutationCache, QueryCache, QueryClient, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api, ApiError } from './api';

/** A 401 anywhere means the session ended (logout elsewhere, expiry, suspension): drop to the sign-in screen. */
function onError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(keys.me, null);
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => error instanceof ApiError && error.retryable && count < 2,
    },
    mutations: { retry: false },
  },
});

/** Everything that changes when the player's money or rounds change. */
export const keys = {
  me: ['me'] as const,
  wallet: ['player', 'wallet'] as const,
  transactions: (filter: TransactionFilter) => ['player', 'transactions', filter] as const,
  history: (gameId?: string) => ['player', 'history', gameId ?? 'all'] as const,
  profile: (since?: number) => ['player', 'profile', since ?? 0] as const,
  rewards: ['player', 'rewards'] as const,
  leaderboard: ['player', 'leaderboard'] as const,
  games: ['games'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api.get<MeResponse>('/api/auth/me');
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useWallet() {
  return useQuery({ queryKey: keys.wallet, queryFn: () => api.get<WalletResponse>('/api/wallet') });
}

export function useGames() {
  return useQuery({ queryKey: keys.games, queryFn: () => api.get<GameConfig[]>('/api/games'), staleTime: 60_000 });
}

/** `since` (ms) scopes the session stats to the current play session. */
export function useProfile(enabled = true, since?: number) {
  return useQuery({
    queryKey: keys.profile(since),
    queryFn: () => api.get<ProfileResponse>(`/api/profile${since ? `?since=${new Date(since).toISOString()}` : ''}`),
    enabled,
  });
}

export function useRewards() {
  return useQuery({ queryKey: keys.rewards, queryFn: () => api.get<RewardsResponse>('/api/rewards') });
}

export function useLeaderboard() {
  return useQuery({ queryKey: keys.leaderboard, queryFn: () => api.get<LeaderboardResponse>('/api/leaderboard') });
}

export function useTransactions(filter: TransactionFilter, limit = 20) {
  return useInfiniteQuery({
    queryKey: keys.transactions(filter),
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api.get<Page<TransactionItem>>(`/api/wallet/transactions?filter=${filter}&limit=${limit}${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useHistory(gameId?: string, limit = 20) {
  return useInfiniteQuery({
    queryKey: keys.history(gameId),
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api.get<Page<HistoryItem>>(
        `/api/games/history?limit=${limit}${gameId ? `&gameId=${gameId}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/**
 * After a round settles: show the new balance (the server's number, never a
 * client calculation) and mark history/stats as stale.
 */
export function useCommitBalance() {
  const qc = useQueryClient();
  return useCallback(
    (virtualBalance: number) => {
      qc.setQueryData<WalletResponse>(keys.wallet, { virtualBalance, currency: 'INR_VIRTUAL' });
      void qc.invalidateQueries({ queryKey: ['player'], predicate: (q) => q.queryKey[1] !== 'wallet' });
    },
    [qc],
  );
}
