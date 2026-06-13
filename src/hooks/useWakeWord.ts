'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * On-device wake-word detection via Picovoice Porcupine (OPTIONAL).
 *
 * Gated entirely on NEXT_PUBLIC_PICOVOICE_ACCESS_KEY. The Porcupine + web voice
 * processor modules are loaded lazily — only when the user enables the toggle
 * and a key is present — so the app never pays the bundle/runtime cost (or
 * breaks) when the key is absent.
 *
 * Honest caveats (surfaced in the UI/README): this only works while the Echo
 * tab is open and focused enough to keep the mic stream alive (a web app has no
 * OS-level background listening), and it needs Chrome/Edge + microphone
 * permission. We use a BUILT-IN keyword ("Computer") so no custom-trained .ppn
 * is required; a custom "Hey Echo" .ppn can be dropped in from the Picovoice
 * console later.
 */

export const PICOVOICE_ACCESS_KEY = process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY ?? '';
export const WAKE_WORD_AVAILABLE = PICOVOICE_ACCESS_KEY.length > 0;

/** The built-in keyword we listen for. */
export const WAKE_KEYWORD = 'Computer';

// Loosely typed handles — the modules are dynamically imported so we avoid a
// hard dependency at module-eval time.
type PorcupineWorkerLike = {
  release: () => Promise<void>;
};

interface UseWakeWordOptions {
  /** Called when the wake word is detected. */
  onWake: () => void;
}

export function useWakeWord({ onWake }: UseWakeWordOptions) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<'off' | 'starting' | 'listening' | 'error'>('off');
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<PorcupineWorkerLike | null>(null);
  const wvpRef = useRef<{ unsubscribe: (e: unknown) => Promise<void> } | null>(null);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  const teardown = useCallback(async () => {
    try {
      if (wvpRef.current && workerRef.current) {
        await wvpRef.current.unsubscribe(workerRef.current);
      }
    } catch {
      /* ignore */
    }
    try {
      await workerRef.current?.release();
    } catch {
      /* ignore */
    }
    workerRef.current = null;
    wvpRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!WAKE_WORD_AVAILABLE) {
      setError('No Picovoice access key configured.');
      setStatus('error');
      return;
    }
    setStatus('starting');
    setError(null);
    try {
      // Lazy-load only now — keeps these out of the bundle path until used.
      const [{ PorcupineWorker, BuiltInKeyword }, { WebVoiceProcessor }] = await Promise.all([
        import('@picovoice/porcupine-web'),
        import('@picovoice/web-voice-processor'),
      ]);

      const worker = await PorcupineWorker.create(
        PICOVOICE_ACCESS_KEY,
        BuiltInKeyword.Computer,
        () => {
          onWakeRef.current();
        },
        { publicPath: '/models/porcupine_params.pv' }
      );

      workerRef.current = worker as unknown as PorcupineWorkerLike;
      wvpRef.current = WebVoiceProcessor as unknown as {
        unsubscribe: (e: unknown) => Promise<void>;
      };

      await WebVoiceProcessor.subscribe(worker);
      setStatus('listening');
    } catch (err) {
      await teardown();
      const msg =
        err instanceof Error ? err.message : 'Wake word failed to start.';
      setError(msg);
      setStatus('error');
      setEnabled(false);
    }
  }, [teardown]);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  // Start / stop in response to the toggle.
  useEffect(() => {
    if (enabled) {
      void start();
    } else {
      void teardown();
      setStatus('off');
      setError(null);
    }
    return () => {
      void teardown();
    };
    // start/teardown are stable; re-run only when `enabled` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    available: WAKE_WORD_AVAILABLE,
    keyword: WAKE_KEYWORD,
    enabled,
    status,
    error,
    toggle,
  };
}
