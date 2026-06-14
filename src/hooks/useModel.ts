'use client';

import { useEffect, useState } from 'react';
import { SHARED_MODEL } from '@/lib/gemini';

/**
 * Selected text/tool model (localStorage). Mirrors useApiKey: SSR-safe (starts
 * at SHARED_MODEL, hydrates from storage in an effect) and syncs across hook
 * instances via a window event. The chosen id is sent to /api/chat, which
 * re-validates it server-side (allowlist + BYOK gate) — this is just the UI
 * preference.
 */

const STORAGE_KEY = 'echo-model';
export const MODEL_CHANGED_EVENT = 'echo-model-changed';

export function useModel() {
  const [model, setModelState] = useState<string>(SHARED_MODEL);

  useEffect(() => {
    const read = () => {
      try {
        setModelState(localStorage.getItem(STORAGE_KEY) || SHARED_MODEL);
      } catch {
        setModelState(SHARED_MODEL);
      }
    };
    read();
    window.addEventListener(MODEL_CHANGED_EVENT, read);
    return () => window.removeEventListener(MODEL_CHANGED_EVENT, read);
  }, []);

  const setModel = (next: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore storage failures */
    }
    setModelState(next);
    window.dispatchEvent(new Event(MODEL_CHANGED_EVENT));
  };

  return { model, setModel };
}
