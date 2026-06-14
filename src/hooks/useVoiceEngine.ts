'use client';

import { useEffect, useState } from 'react';

/**
 * Voice-engine selector (localStorage). Mirrors useDevView/useModel: SSR-safe
 * (starts at 'classic', hydrates from storage in an effect) and syncs across
 * hook instances via a window event.
 *
 *  - 'classic' — the hand-built pipeline (Web Speech STT + SSE text + browser
 *    TTS). The DEFAULT; behaves exactly as before.
 *  - 'live'    — Gemini native Live API (ai.live.connect). Opt-in; only opens a
 *    socket on an explicit Connect click (TPM budget, §7).
 */

export type VoiceEngine = 'classic' | 'live';

const STORAGE_KEY = 'echo-voice-engine';
export const VOICE_ENGINE_CHANGED_EVENT = 'echo-voice-engine-changed';

export function useVoiceEngine() {
  const [engine, setEngineState] = useState<VoiceEngine>('classic');

  useEffect(() => {
    const read = () => {
      try {
        setEngineState(localStorage.getItem(STORAGE_KEY) === 'live' ? 'live' : 'classic');
      } catch {
        setEngineState('classic');
      }
    };
    read();
    window.addEventListener(VOICE_ENGINE_CHANGED_EVENT, read);
    return () => window.removeEventListener(VOICE_ENGINE_CHANGED_EVENT, read);
  }, []);

  const setEngine = (next: VoiceEngine) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore storage failures */
    }
    setEngineState(next);
    window.dispatchEvent(new Event(VOICE_ENGINE_CHANGED_EVENT));
  };

  return { engine, setEngine };
}
