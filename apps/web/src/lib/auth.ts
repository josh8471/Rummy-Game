import type { MeResponse } from '@casino/shared';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { api } from './api';
import { resetPlaySession } from './playSession';
import { keys, queryClient, useMe } from './queries';

export function useSession() {
  const me = useMe();
  return { ...me, user: me.data?.user ?? null, sessionStartedAt: me.data?.sessionStartedAt ?? null };
}

export function setSession(session: MeResponse) {
  resetPlaySession();
  queryClient.clear();
  queryClient.setQueryData(keys.me, session);
}

export function useLogout() {
  const navigate = useNavigate();
  return useCallback(
    async (message?: string) => {
      try {
        await api.post('/api/auth/logout');
      } finally {
        resetPlaySession();
        queryClient.clear();
        queryClient.setQueryData(keys.me, null);
        navigate('/login', { replace: true, state: message ? { message } : undefined });
      }
    },
    [navigate],
  );
}
