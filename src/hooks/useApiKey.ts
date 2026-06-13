'use client';

import { useEffect, useState } from 'react';

/**
 * BYOK key storage (localStorage). Ported and slimmed from gemini-chat-app.
 * The key never leaves the browser except as a per-request header to our own
 * /api/chat route; it is never logged or persisted server-side.
 */

const STORAGE_KEY = 'echo-api-key';
export const API_KEY_CHANGED_EVENT = 'echo-api-key-changed';

/** Loose validation — Google AI Studio keys start with "AIza" / "AQ.". */
export function looksLikeKey(key: string): boolean {
  const k = key.trim();
  return k.length >= 20 && /^[A-Za-z0-9._-]+$/.test(k);
}

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  useEffect(() => {
    try {
      setApiKeyState(localStorage.getItem(STORAGE_KEY));
    } catch {
      setApiKeyState(null);
    }
    const sync = () => {
      try {
        setApiKeyState(localStorage.getItem(STORAGE_KEY));
      } catch {
        setApiKeyState(null);
      }
    };
    window.addEventListener(API_KEY_CHANGED_EVENT, sync);
    return () => window.removeEventListener(API_KEY_CHANGED_EVENT, sync);
  }, []);

  const saveApiKey = (key: string) => {
    const trimmed = key.trim();
    if (!looksLikeKey(trimmed)) {
      throw new Error('That does not look like a valid Gemini API key.');
    }
    localStorage.setItem(STORAGE_KEY, trimmed);
    setApiKeyState(trimmed);
    window.dispatchEvent(new Event(API_KEY_CHANGED_EVENT));
  };

  const removeApiKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState(null);
    window.dispatchEvent(new Event(API_KEY_CHANGED_EVENT));
  };

  return { apiKey, hasApiKey: !!apiKey, saveApiKey, removeApiKey };
}
