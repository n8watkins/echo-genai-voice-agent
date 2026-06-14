'use client';

import { useEffect, useState } from 'react';

/**
 * "Under the hood" dev-view toggle (localStorage). Mirrors useModel/useApiKey:
 * SSR-safe (starts off, hydrates from storage in an effect) and syncs across
 * hook instances via a window event. Off by default — the normal product is
 * untouched until a visitor opts in.
 */

const STORAGE_KEY = 'echo-dev-view';
export const DEV_VIEW_CHANGED_EVENT = 'echo-dev-view-changed';

export function useDevView() {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setEnabledState(localStorage.getItem(STORAGE_KEY) === '1');
      } catch {
        setEnabledState(false);
      }
    };
    read();
    window.addEventListener(DEV_VIEW_CHANGED_EVENT, read);
    return () => window.removeEventListener(DEV_VIEW_CHANGED_EVENT, read);
  }, []);

  const setEnabled = (next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore storage failures */
    }
    setEnabledState(next);
    window.dispatchEvent(new Event(DEV_VIEW_CHANGED_EVENT));
  };

  const toggle = () => setEnabled(!enabled);

  return { enabled, setEnabled, toggle };
}
