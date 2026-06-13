'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Speech API (SpeechRecognition) wrapper — the STT seam.
 *
 * Abstracted so a cloud STT can drop in later: callers only see start/stop and
 * interim/final callbacks, never the browser API directly. Feature-detects on
 * load (Chrome/Edge only; iOS Safari effectively unsupported) so the UI can
 * fall back to the first-class text input.
 */

export interface UseSpeechRecognitionOptions {
  lang?: string;
  /** continuous = hands-free; false = single utterance (push-to-talk). */
  continuous?: boolean;
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = 'en-US', continuous = false } = options;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const manualStopRef = useRef(false);
  // Keep the latest callbacks without re-creating the recognizer.
  const cbRef = useRef(options);
  cbRef.current = options;

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const ensureRecognizer = useCallback((): SpeechRecognition | null => {
    if (typeof window === 'undefined') return null;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;

    if (recognitionRef.current) return recognitionRef.current;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (interim) cbRef.current.onInterim?.(interim);
      if (finalText) cbRef.current.onFinal?.(finalText.trim());
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      // "no-speech"/"aborted" are routine; surface the rest.
      if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
        cbRef.current.onError?.(ev.error);
      }
    };

    rec.onend = () => {
      setListening(false);
      cbRef.current.onEnd?.();
      // Auto-restart in continuous mode unless the caller stopped us.
      if (continuous && !manualStopRef.current) {
        try {
          rec.start();
          setListening(true);
        } catch {
          /* already started or not allowed */
        }
      }
    };

    recognitionRef.current = rec;
    return rec;
  }, [lang, continuous]);

  const start = useCallback(() => {
    const rec = ensureRecognizer();
    if (!rec) return;
    manualStopRef.current = false;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if already running — ignore.
    }
  }, [ensureRecognizer]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* not running */
    }
    setListening(false);
  }, []);

  const abort = useCallback(() => {
    manualStopRef.current = true;
    try {
      recognitionRef.current?.abort();
    } catch {
      /* not running */
    }
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  return { supported, listening, start, stop, abort };
}
