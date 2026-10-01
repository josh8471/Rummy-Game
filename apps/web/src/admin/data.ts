import type {
  AdminGameConfig,
  AdminOverview,
  AdminPlayerDetail,
  AdminPlayerRow,
  AuditLogItem,
  Page,
  ProfileItem,
  SecurityEventItem,
} from '@casino/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export const adminKeys = {
  all: ['admin'] as const,
  overview: ['admin', 'overview'] as const,
  players: (search: string) => ['admin', 'players', search] as const,
  player: (id: string) => ['admin', 'player', id] as const,
  profiles: ['admin', 'profiles'] as const,
  games: ['admin', 'games'] as const,
  audit: ['admin', 'audit'] as const,
  security: ['admin', 'security'] as const,
};

export const useOverview = () => useQuery({ queryKey: adminKeys.overview, queryFn: () => api.get<AdminOverview>('/api/admin/overview') });

export function usePlayers(search: string) {
  return useInfiniteQuery({
    queryKey: adminKeys.players(search),
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api.get<Page<AdminPlayerRow> & { total: number }>(
        `/api/admin/players?limit=25${search ? `&search=${encodeURIComponent(search)}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export const usePlayer = (id: string) =>
  useQuery({ queryKey: adminKeys.player(id), queryFn: () => api.get<AdminPlayerDetail>(`/api/admin/players/${id}`) });

export const useProfiles = () => useQuery({ queryKey: adminKeys.profiles, queryFn: () => api.get<ProfileItem[]>('/api/admin/profiles') });

export const useAdminGames = () => useQuery({ queryKey: adminKeys.games, queryFn: () => api.get<AdminGameConfig[]>('/api/admin/games') });

export function useAuditLogs() {
  return useInfiniteQuery({
    queryKey: adminKeys.audit,
    initialPageParam: '',
    queryFn: ({ pageParam }) => api.get<Page<AuditLogItem>>(`/api/admin/audit-logs?limit=25${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export const useSecurityEvents = () =>
  useQuery({ queryKey: adminKeys.security, queryFn: () => api.get<SecurityEventItem[]>('/api/admin/security-events') });

/** Any admin write: refresh every admin view (and the games list players see). */
export function useAdminMutation<TBody, TRes = unknown>(method: 'put' | 'post', path: (body: TBody) => string, strip?: (body: TBody) => unknown) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => (method === 'put' ? api.put<TRes>(path(body), strip ? strip(body) : body) : api.post<TRes>(path(body), strip ? strip(body) : body)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.all });
      void qc.invalidateQueries({ queryKey: ['games'] });
    },
  });
}
