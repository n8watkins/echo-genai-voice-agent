'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { transition, type TurnState } from '@/lib/conversation/turnMachine';
import { SentenceChunker } from '@/lib/conversation/sentenceChunker';
import { decodeSSE } from '@/lib/sse';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeech } from './useSpeech';
import { useApiKey } from './useApiKey';
import { useModel } from './useModel';

/**
 * The orchestrator. Drives the turn-taking state machine across the full
 * spoken loop: STT -> SSE token stream -> sentence chunker -> TTS, plus
 * barge-in.
 *
 * Conversation model:
 *  - Hands-free + barge-in is the default; push-to-talk is the alternative mode.
 *  - Text input is first-class (submitText) and works with no mic.
 *  - The chunker/TTS queue tolerate the mid-stream pause of a tool call.
 *
 * Self-interrupt mitigation (the hands-free echo-loop problem):
 *  The Web Speech API gives us no raw mic stream, so we can't run echo
 *  cancellation against Echo's own TTS. Without mitigation, the continuous
 *  recognizer transcribes Echo's voice from the laptop speaker and fires a
 *  false BARGE_IN, cutting Echo off mid-sentence. We mitigate three ways:
 *    1. PAUSE the continuous recognizer the moment Echo starts speaking, and
 *       RESUME it only after a short post-TTS cooldown — so it literally can't
 *       hear most of Echo's own output.
 *    2. A BARGE_IN_COOLDOWN_MS window after speech ends during which interim
 *       results are ignored (catches any trailing audio after resume).
 *    3. A MIN_BARGE_IN_CHARS floor so a stray syllable isn't treated as a real
 *       interrupt — a genuine user interruption produces a longer interim.
 *  Genuine barge-in (the user actually talking over Echo) still works because
 *  pause()/resume() can be raced by real speech and the length/cooldown gates
 *  only filter the short, echo-like noise.
 */

// How long after Echo finishes speaking before the recognizer is resumed and
// barge-in is honored again. Covers TTS tail audio bleeding into the mic.
const BARGE_IN_COOLDOWN_MS = 600;
// Minimum interim transcript length to treat as a real barge-in (vs. an echo
// fragment of Echo's own speech).
const MIN_BARGE_IN_CHARS = 4;

export interface LogTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const HISTORY_LIMIT = 12; // turns of context sent to the model

export interface UseVoiceAgentOptions {
  /** Active persona's system prompt, forwarded to /api/chat. */
  systemPrompt?: string | null;
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
  const [state, setState] = useState<TurnState>('idle');
  // Hands-free + barge-in is the default conversation mode; push-to-talk is the
  // alternative selected from the top-bar Mode toggle.
  const [handsFree, setHandsFree] = useState(true);
  const [interim, setInterim] = useState('');
  const [partialReply, setPartialReply] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogTurn[]>([]);

  const { apiKey } = useApiKey();
  const { model } = useModel();
  const speech = useSpeech();

  // Refs that callbacks need without stale closures.
  const stateRef = useRef<TurnState>('idle');
  const handsFreeRef = useRef(true);
  const logRef = useRef<LogTurn[]>([]);
  const chunkerRef = useRef(new SentenceChunker());
  const abortRef = useRef<AbortController | null>(null);
  const speakingStartedRef = useRef(false);
  const apiKeyRef = useRef<string | null>(null);
  const modelRef = useRef<string>(model);
  const systemPromptRef = useRef<string | null>(options.systemPrompt ?? null);
  // Timestamp until which barge-in is suppressed (post-TTS cooldown).
  const bargeInBlockedUntilRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);
  useEffect(() => {
    logRef.current = log;
  }, [log]);
  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  useEffect(() => {
    systemPromptRef.current = options.systemPrompt ?? null;
  }, [options.systemPrompt]);

  const dispatch = useCallback((event: Parameters<typeof transition>[1]) => {
    setState((prev) => transition(prev, event, { handsFree: handsFreeRef.current }));
  }, []);

  // ---- Forward declaration via ref so STT callbacks can call think() -------
  const thinkRef = useRef<(text: string) => Promise<void>>(async () => {});

  // Shared barge-in / interim handler. With the recognizer paused while Echo
  // speaks, this rarely sees Echo's own audio — but it still gates on the
  // post-TTS cooldown and a minimum interim length so trailing echo can't
  // trigger a false interrupt. A genuine, sustained user utterance clears both
  // gates and cuts Echo off.
  const handleInterim = useCallback(
    (text: string) => {
      if (stateRef.current === 'speaking') {
        const longEnough = text.trim().length >= MIN_BARGE_IN_CHARS;
        const pastCooldown = Date.now() >= bargeInBlockedUntilRef.current;
        if (longEnough && pastCooldown) {
          // Real barge-in: cancel speech, drop queued sentences, abort stream.
          speech.cancel();
          chunkerRef.current.reset();
          abortRef.current?.abort();
          dispatch({ type: 'BARGE_IN' });
        } else {
          // Likely an echo fragment of Echo's own TTS — ignore it entirely.
          return;
        }
      }
      setInterim(text);
    },
    [speech, dispatch]
  );

  const handleFinal = useCallback((text: string) => {
    setInterim('');
    if (text.trim()) void thinkRef.current(text.trim());
  }, []);

  const handleSttError = useCallback(
    (err: string) => {
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setError('Microphone access was blocked. You can type instead.');
        dispatch({ type: 'ERROR' });
      }
    },
    [dispatch]
  );

  // STT --------------------------------------------------------------------
  const recognition = useSpeechRecognition({
    continuous: false, // push-to-talk: single utterance
    onInterim: handleInterim,
    onFinal: handleFinal,
    onError: handleSttError,
  });

  // Continuous (hands-free) recognizer is a separate instance so toggling
  // modes doesn't fight the push-to-talk recognizer.
  const contRecognition = useSpeechRecognition({
    continuous: true,
    onInterim: handleInterim,
    onFinal: handleFinal,
    onError: handleSttError,
  });

  const micSupported = recognition.supported;

  // THINK: send to the model, stream tokens, speak as sentences complete -----
  const think = useCallback(
    async (userText: string) => {
      setError(null);
      setActiveTool(null);
      setPartialReply('');
      chunkerRef.current.reset();
      speakingStartedRef.current = false;

      const userTurn: LogTurn = { id: crypto.randomUUID(), role: 'user', text: userText };
      setLog((prev) => [...prev, userTurn]);
      dispatch({ type: 'FINAL_TRANSCRIPT' }); // -> thinking

      const history = logRef.current
        .slice(-HISTORY_LIMIT)
        .map((t) => ({ role: t.role, text: t.text }));

      const controller = new AbortController();
      abortRef.current = controller;

      let assembled = '';
      const speakChunk = (sentence: string) => {
        if (!sentence) return;
        if (!speakingStartedRef.current) {
          speakingStartedRef.current = true;
          // Pause the hands-free recognizer so it can't transcribe Echo's own
          // TTS and self-interrupt. Push-to-talk isn't running here.
          if (handsFreeRef.current) contRecognition.pause();
          dispatch({ type: 'FIRST_SENTENCE' }); // thinking -> speaking
        }
        speech.enqueue(sentence);
      };

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            history,
            apiKey: apiKeyRef.current,
            model: modelRef.current,
            systemPrompt: systemPromptRef.current,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const msg =
            res.status === 503
              ? 'No API key available. Add your own free Gemini key to talk.'
              : `Request failed (${res.status}).`;
          setError(msg);
          dispatch({ type: 'ERROR' });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const { events, rest } = decodeSSE(sseBuffer);
          sseBuffer = rest;

          for (const ev of events) {
            if (ev.type === 'token') {
              assembled += ev.text;
              setPartialReply(assembled);
              // Chunker tolerates the tool-call gap: it just keeps buffering.
              for (const sentence of chunkerRef.current.push(ev.text)) {
                speakChunk(sentence);
              }
            } else if (ev.type === 'tool') {
              setActiveTool(ev.name);
            } else if (ev.type === 'error') {
              setError(ev.message);
            } else if (ev.type === 'done') {
              for (const sentence of chunkerRef.current.flush()) speakChunk(sentence);
            }
          }
        }

        const finalText = assembled.trim();
        if (finalText) {
          setLog((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', text: finalText },
          ]);
        }
        setPartialReply('');
        setActiveTool(null);

        if (!speakingStartedRef.current) {
          // Nothing speakable was produced — return to a listening/idle state.
          dispatch({ type: 'SPEECH_END' });
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return; // barge-in cancelled
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        dispatch({ type: 'ERROR' });
      }
    },
    [dispatch, speech, contRecognition]
  );

  useEffect(() => {
    thinkRef.current = think;
  }, [think]);

  // When TTS finishes its whole queue, end the turn.
  const prevSpeaking = useRef(false);
  useEffect(() => {
    if (prevSpeaking.current && !speech.speaking && stateRef.current === 'speaking') {
      dispatch({ type: 'SPEECH_END' });
      if (handsFreeRef.current) {
        // Suppress barge-in briefly to absorb any TTS tail audio, then resume
        // the recognizer so the user can speak the next turn hands-free.
        bargeInBlockedUntilRef.current = Date.now() + BARGE_IN_COOLDOWN_MS;
        setTimeout(() => contRecognition.resume(), BARGE_IN_COOLDOWN_MS);
      }
    }
    prevSpeaking.current = speech.speaking;
  }, [speech.speaking, dispatch, contRecognition]);

  // PUBLIC CONTROLS --------------------------------------------------------

  /** Push-to-talk: begin capturing a single utterance. */
  const startListening = useCallback(() => {
    setError(null);
    if (stateRef.current === 'speaking') {
      speech.cancel();
      chunkerRef.current.reset();
      abortRef.current?.abort();
    }
    if (handsFreeRef.current) {
      contRecognition.start();
    } else {
      recognition.start();
    }
    dispatch({ type: 'MIC_ON' });
  }, [recognition, contRecognition, speech, dispatch]);

  /** Stop capturing (push-to-talk release). The final transcript triggers think. */
  const stopListening = useCallback(() => {
    recognition.stop();
    if (stateRef.current === 'listening') {
      // No speech arrived; go back to idle.
      dispatch({ type: 'MIC_OFF' });
    }
  }, [recognition, dispatch]);

  /** Full stop: cancel TTS, abort any stream, stop recognizers, go idle. */
  const stopAll = useCallback(() => {
    speech.cancel();
    chunkerRef.current.reset();
    abortRef.current?.abort();
    recognition.abort();
    contRecognition.abort();
    setInterim('');
    dispatch({ type: 'MIC_OFF' });
  }, [speech, recognition, contRecognition, dispatch]);

  /** Set hands-free mode explicitly (Conversation = true, Push-to-talk = false). */
  const setMode = useCallback(
    (next: boolean) => {
      setHandsFree((prev) => {
        if (prev === next) return prev;
        // Stop whichever recognizer was running so the modes don't fight.
        recognition.abort();
        contRecognition.abort();
        if (stateRef.current !== 'idle') dispatch({ type: 'MIC_OFF' });
        return next;
      });
    },
    [recognition, contRecognition, dispatch]
  );

  /** Toggle between hands-free (default) and push-to-talk. */
  const toggleHandsFree = useCallback(() => {
    setMode(!handsFreeRef.current);
  }, [setMode]);

  /** First-class text fallback — works with no mic at all. */
  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (stateRef.current === 'speaking') {
        speech.cancel();
        chunkerRef.current.reset();
        abortRef.current?.abort();
      }
      void thinkRef.current(trimmed);
    },
    [speech]
  );

  const clearLog = useCallback(() => setLog([]), []);

  return {
    // state
    state,
    handsFree,
    interim,
    partialReply,
    activeTool,
    error,
    log,
    micSupported,
    // tts controls/info
    speech,
    // controls
    startListening,
    stopListening,
    stopAll,
    toggleHandsFree,
    setHandsFree: setMode,
    submitText,
    clearLog,
  };
}
