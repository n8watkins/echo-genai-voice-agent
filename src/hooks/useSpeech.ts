'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceHint } from '@/lib/personas';

/**
 * speechSynthesis (TTS) wrapper — the TTS seam.
 *
 * Provides a sentence queue so the orchestrator can enqueue chunks as the model
 * streams (speak-as-you-stream). Cloud TTS can replace this later behind the
 * same enqueue/cancel/voices interface.
 *
 * Free voice-quality upgrade: we score the available browser voices with
 * heuristics (Natural / Neural / Google / Premium / Enhanced names, and online
 * voices where localService === false) and surface a "Recommended" group. We
 * also honor the active persona's voiceHint as the default voice, while a manual
 * user override persists in localStorage.
 */

export interface SpeechVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  /** True when our heuristics rate this a higher-quality voice. */
  recommended: boolean;
}

const VOICE_PREF_KEY = 'echo-voice-uri';

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Markers that usually indicate a higher-quality / neural voice. */
const QUALITY_MARKERS = ['natural', 'neural', 'google', 'premium', 'enhanced'];

/** Score a voice for quality — higher is better. */
function qualityScore(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name.toLowerCase();
  for (const marker of QUALITY_MARKERS) {
    if (name.includes(marker)) score += 3;
  }
  // Online (cloud) voices are generally far nicer than local compact ones.
  if (!v.localService) score += 2;
  // "Compact" / "eSpeak" voices are the robotic ones.
  if (name.includes('compact') || name.includes('espeak')) score -= 3;
  return score;
}

/** A voice is "recommended" if it scores above the robotic baseline. */
function isRecommended(v: SpeechSynthesisVoice): boolean {
  return qualityScore(v) >= 2;
}

/** Heuristic default: best-quality English voice when no hint/override applies. */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = en.length ? en : voices;
  const sorted = [...pool].sort((a, b) => qualityScore(b) - qualityScore(a));
  if (qualityScore(sorted[0]) > 0) return sorted[0];
  return pool.find((v) => v.default) ?? pool[0];
}

// Loose name hints for guessing voice gender (best-effort across platforms).
const FEMALE_HINTS = [
  'female', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona',
  'aria', 'jenny', 'zira', 'susan', 'allison', 'ava', 'serena', 'sonia', 'emma',
];
const MALE_HINTS = [
  'male', 'daniel', 'alex', 'fred', 'oliver', 'thomas', 'david', 'mark',
  'guy', 'ryan', 'george', 'james', 'aaron', 'arthur', 'rishi',
];

function guessGender(v: SpeechSynthesisVoice): 'male' | 'female' | 'any' {
  const name = v.name.toLowerCase();
  if (FEMALE_HINTS.some((h) => name.includes(h))) return 'female';
  if (MALE_HINTS.some((h) => name.includes(h))) return 'male';
  return 'any';
}

/** Pick the best voice matching a persona's hint, with quality as a tiebreak. */
export function pickVoiceForHint(
  voices: SpeechSynthesisVoice[],
  hint: VoiceHint
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const lang = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(hint.langPrefix.toLowerCase())
  );
  const pool = lang.length ? lang : voices;

  const scoreFor = (v: SpeechSynthesisVoice): number => {
    let s = qualityScore(v);
    if (hint.nameContains && v.name.toLowerCase().includes(hint.nameContains.toLowerCase())) {
      s += 10; // a named match is a strong signal
    }
    if (hint.gender !== 'any' && guessGender(v) === hint.gender) s += 4;
    return s;
  };

  const sorted = [...pool].sort((a, b) => scoreFor(b) - scoreFor(a));
  return sorted[0] ?? pickBestVoice(voices);
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedURI, setSelectedURI] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  // True once the user explicitly overrides the voice — persona hints stop
  // overriding their choice after that (the override persists across sessions).
  const userOverrodeRef = useRef(false);

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
        if (saved && list.some((v) => v.voiceURI === saved)) {
          userOverrodeRef.current = true; // a saved pref is a user choice
          return saved;
        }
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

  const rateRef = useRef(rate);
  const pitchRef = useRef(pitch);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    pitchRef.current = pitch;
  }, [pitch]);

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
    utter.rate = rateRef.current;
    utter.pitch = pitchRef.current;
    utter.onend = () => speakNext();
    utter.onerror = () => speakNext();
    window.speechSynthesis.speak(utter);
  }, [resolveVoice]);

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

  /** Manual user voice selection — persists and disables hint auto-switching. */
  const selectVoice = useCallback((uri: string) => {
    userOverrodeRef.current = true;
    setSelectedURI(uri);
    try {
      localStorage.setItem(VOICE_PREF_KEY, uri);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Apply a persona's voice hint as the default voice. No-op once the user has
   * explicitly overridden the voice, so their choice always wins.
   */
  const applyVoiceHint = useCallback(
    (hint: VoiceHint) => {
      if (userOverrodeRef.current) return;
      if (voices.length === 0) return;
      const match = pickVoiceForHint(voices, hint);
      if (match) setSelectedURI(match.voiceURI);
    },
    [voices]
  );

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
    recommended: isRecommended(v),
  }));

  return {
    supported,
    speaking,
    voices: voiceList,
    selectedURI,
    selectVoice,
    applyVoiceHint,
    rate,
    setRate,
    pitch,
    setPitch,
    enqueue,
    cancel,
    preview,
  };
}
