'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { transition, type TurnState } from '@/lib/conversation/turnMachine';
import { SentenceChunker } from '@/lib/conversation/sentenceChunker';
import { decodeSSE } from '@/lib/sse';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeech } from './useSpeech';
import { useApiKey } from './useApiKey';

/**
 * The orchestrator. Drives the turn-taking state machine across the full
 * spoken loop: STT -> SSE token stream -> sentence chunker -> TTS, plus
 * barge-in.
 *
 * Per §12a:
 *  - Push-to-talk is the reliable default; hands-free is a best-effort toggle.
 *  - Text input is first-class (submitText) and works with no mic.
 *  - The chunker/TTS queue tolerate the mid-stream pause of a tool call.
 */

export interface LogTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const HISTORY_LIMIT = 12; // turns of context sent to the model

export function useVoiceAgent() {
  const [state, setState] = useState<TurnState>('idle');
  const [handsFree, setHandsFree] = useState(false);
  const [interim, setInterim] = useState('');
  const [partialReply, setPartialReply] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogTurn[]>([]);

  const { apiKey } = useApiKey();
  const speech = useSpeech();

  // Refs that callbacks need without stale closures.
  const stateRef = useRef<TurnState>('idle');
  const handsFreeRef = useRef(false);
  const logRef = useRef<LogTurn[]>([]);
  const chunkerRef = useRef(new SentenceChunker());
  const abortRef = useRef<AbortController | null>(null);
  const speakingStartedRef = useRef(false);
  const apiKeyRef = useRef<string | null>(null);

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

  const dispatch = useCallback((event: Parameters<typeof transition>[1]) => {
    setState((prev) => transition(prev, event, { handsFree: handsFreeRef.current }));
  }, []);

  // ---- Forward declaration via ref so STT callbacks can call think() -------
  const thinkRef = useRef<(text: string) => Promise<void>>(async () => {});

  // STT --------------------------------------------------------------------
  const recognition = useSpeechRecognition({
    continuous: false, // push-to-talk default; hands-free handled separately below
    onInterim: (text) => {
      // Barge-in: if Echo is speaking and the user starts talking, cut it off.
      if (stateRef.current === 'speaking') {
        speech.cancel();
        chunkerRef.current.reset();
        abortRef.current?.abort();
        dispatch({ type: 'BARGE_IN' });
      }
      setInterim(text);
    },
    onFinal: (text) => {
      setInterim('');
      if (text.trim()) void thinkRef.current(text.trim());
    },
    onError: (err) => {
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setError('Microphone access was blocked. You can type instead.');
        dispatch({ type: 'ERROR' });
      }
    },
  });

  // Continuous (hands-free) recognizer is a separate instance so toggling
  // modes doesn't fight the push-to-talk recognizer.
  const contRecognition = useSpeechRecognition({
    continuous: true,
    onInterim: (text) => {
      if (stateRef.current === 'speaking') {
        speech.cancel();
        chunkerRef.current.reset();
        abortRef.current?.abort();
        dispatch({ type: 'BARGE_IN' });
      }
      setInterim(text);
    },
    onFinal: (text) => {
      setInterim('');
      if (text.trim()) void thinkRef.current(text.trim());
    },
    onError: (err) => {
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setError('Microphone access was blocked. You can type instead.');
        dispatch({ type: 'ERROR' });
      }
    },
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
          dispatch({ type: 'FIRST_SENTENCE' }); // thinking -> speaking
        }
        speech.enqueue(sentence);
      };

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userText, history, apiKey: apiKeyRef.current }),
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
    [dispatch, speech]
  );

  useEffect(() => {
    thinkRef.current = think;
  }, [think]);

  // When TTS finishes its whole queue, end the turn.
  const prevSpeaking = useRef(false);
  useEffect(() => {
    if (prevSpeaking.current && !speech.speaking && stateRef.current === 'speaking') {
      dispatch({ type: 'SPEECH_END' });
      // In hands-free mode, the continuous recognizer is already running.
    }
    prevSpeaking.current = speech.speaking;
  }, [speech.speaking, dispatch]);

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

  /** Toggle hands-free best-effort mode. */
  const toggleHandsFree = useCallback(() => {
    setHandsFree((prev) => {
      const next = !prev;
      // Stop whichever recognizer was running.
      recognition.abort();
      contRecognition.abort();
      if (stateRef.current !== 'idle') dispatch({ type: 'MIC_OFF' });
      return next;
    });
  }, [recognition, contRecognition, dispatch]);

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
    submitText,
    clearLog,
  };
}
