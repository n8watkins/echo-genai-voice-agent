'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * speechSynthesis (TTS) wrapper — the TTS seam.
 *
 * Provides a sentence queue so the orchestrator can enqueue chunks as the model
 * streams (speak-as-you-stream). Cloud TTS can replace this later behind the
 * same enqueue/cancel/voices interface — named as the explicit upgrade path in
 * the blog because local voices are robotic.
 *
 * Per §12a we auto-select the best available local voice.
 */

export interface SpeechVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

const VOICE_PREF_KEY = 'echo-voice-uri';

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Heuristic: prefer high-quality, English, non-"Google compact" voices. */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = en.length ? en : voices;
  // Preference order of known nicer voices.
  const preferred = [
    'Google US English',
    'Samantha',
    'Microsoft Aria',
    'Microsoft Jenny',
    'Microsoft Zira',
    'Daniel',
  ];
  for (const name of preferred) {
    const hit = pool.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  // Otherwise the platform default, else the first English voice.
  return pool.find((v) => v.default) ?? pool[0];
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedURI, setSelectedURI] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);

  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(false);

  // Load voices (they arrive asynchronously in most browsers).
  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return;
    setSupported(true);

    const load = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length === 0) return;
      setVoices(list);
      setSelectedURI((prev) => {
        if (prev) return prev;
        const saved = localStorage.getItem(VOICE_PREF_KEY);
        if (saved && list.some((v) => v.voiceURI === saved)) return saved;
        return pickBestVoice(list)?.voiceURI ?? null;
      });
    };

    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const resolveVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    return voices.find((v) => v.voiceURI === selectedURI);
  }, [voices, selectedURI]);

  const speakNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      activeRef.current = false;
      setSpeaking(false);
      return;
    }
    const text = queueRef.current.shift()!;
    const utter = new SpeechSynthesisUtterance(text);
    const voice = resolveVoice();
    if (voice) utter.voice = voice;
    utter.rate = rate;
    utter.pitch = pitch;
    utter.onend = () => speakNext();
    utter.onerror = () => speakNext();
    window.speechSynthesis.speak(utter);
  }, [resolveVoice, rate, pitch]);

  /** Enqueue a sentence to be spoken; starts playback if idle. */
  const enqueue = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      queueRef.current.push(text);
      if (!activeRef.current) {
        activeRef.current = true;
        setSpeaking(true);
        speakNext();
      }
    },
    [supported, speakNext]
  );

  /** Hard stop: clear the queue and cancel anything mid-utterance (barge-in). */
  const cancel = useCallback(() => {
    queueRef.current = [];
    activeRef.current = false;
    setSpeaking(false);
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
  }, []);

  const selectVoice = useCallback((uri: string) => {
    setSelectedURI(uri);
    try {
      localStorage.setItem(VOICE_PREF_KEY, uri);
    } catch {
      /* ignore */
    }
  }, []);

  // Speak a short test phrase with the current voice/rate/pitch.
  const preview = useCallback(() => {
    cancel();
    enqueue('Hi, I am Echo. This is how I sound.');
  }, [cancel, enqueue]);

  const voiceList: SpeechVoice[] = voices.map((v) => ({
    voiceURI: v.voiceURI,
    name: v.name,
    lang: v.lang,
    localService: v.localService,
    default: v.default,
  }));

  return {
    supported,
    speaking,
    voices: voiceList,
    selectedURI,
    selectVoice,
    rate,
    setRate,
    pitch,
    setPitch,
    enqueue,
    cancel,
    preview,
  };
}
