'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { LogTurn } from '@/hooks/useVoiceAgent';

export interface ConvSummary {
  id: string;
  engine: string;
  persona: string | null;
  title: string;
  updatedAt: number;
}

/**
 * Client access to saved conversations. Only active when signed in; every
 * method no-ops otherwise. The server scopes everything to the session user, so
 * we never send an owner id from the browser.
 */
export function useConversations() {
  const { status } = useSession();
  const signedIn = status === 'authenticated';
  const [list, setList] = useState<ConvSummary[]>([]);

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setList([]);
      return;
    }
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setList(Array.isArray(data.conversations) ? data.conversations : []);
    } catch {
      /* offline / not configured — leave list as-is */
    }
  }, [signedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (payload: { id: string; engine: string; persona: string | null; turns: LogTurn[] }) => {
      if (!signedIn) return;
      try {
        await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: payload.id,
            engine: payload.engine,
            persona: payload.persona,
            turns: payload.turns.map((t) => ({ role: t.role, text: t.text })),
          }),
        });
        void refresh();
      } catch {
        /* best-effort */
      }
    },
    [signedIn, refresh]
  );

  const load = useCallback(async (id: string): Promise<LogTurn[] | null> => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      const turns = data?.conversation?.turns;
      if (!Array.isArray(turns)) return null;
      return turns.map((t: { role: string; text: string }, i: number) => ({
        id: `${id}:${i}`,
        role: t.role === 'assistant' ? 'assistant' : 'user',
        text: t.text,
      }));
    } catch {
      return null;
    }
  }, []);

  const remove = useCallback(
    async (id: string) => {
      if (!signedIn) return;
      try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
        void refresh();
      } catch {
        /* best-effort */
      }
    },
    [signedIn, refresh]
  );

  return { signedIn, list, refresh, save, load, remove };
}
