'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GoogleGenAI,
  Modality,
  type FunctionCall,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import { type TraceEvent } from '@/lib/devtrace';
import { type LogTurn } from '@/hooks/useVoiceAgent';
import {
  LIVE_MODEL,
  INPUT_MIME_TYPE,
  OUTPUT_SAMPLE_RATE,
  float32ToBase64PCM16,
  base64PCM16ToFloat32,
  downsampleTo16k,
} from '@/lib/live';

/**
 * Mode B — the native Gemini Live API voice engine (docs/UNDER_THE_HOOD.md
 * §4d). A PARALLEL code path to the hand-built useVoiceAgent pipeline; the two
 * never run at once (the engine toggle picks one). This hook owns the entire
 * Live lifecycle:
 *
 *   1. fetch an ephemeral token from /api/live-token (raw key stays server-side)
 *   2. ai.live.connect({ model, config:{responseModalities:[AUDIO]}, callbacks })
 *      using the token as the apiKey (apiVersion 'v1alpha' for ephemeral tokens)
 *   3. capture mic audio via Web Audio (ScriptProcessor) -> PCM16@16k ->
 *      session.sendRealtimeInput({ audio })
 *   4. play received PCM@24k chunks through a scheduled Web Audio queue
 *   5. clean up socket + audio graph on disconnect/unmount
 *
 * Telemetry: emits the SAME TraceEvent shape the DevPanel already renders —
 * `state` transitions (idle/listening/thinking/speaking) and a `turn-total`
 * stage (user-speech-end -> first audio out), plus a tokens/TPM model_call so
 * the side-by-side comparison with Classic mode is concrete. Per §9 the panel
 * shows tokens (no $) for Live since audio pricing is unconfirmed.
 *
 * Gating: connect() only runs on an explicit user action (the engine toggle's
 * "Connect" click). Nothing opens a socket on mount — that protects the shared
 * TPM budget.
 */

export type LiveStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface UseLiveSessionOptions {
  systemPrompt?: string | null;
}

export interface UseLiveSession {
  status: LiveStatus;
  connected: boolean;
  error: string | null;
  /** Most-recent turn's trace, in the shared DevPanel shape. */
  trace: TraceEvent[];
  /** Conversation turns (both sides), same shape Classic uses for the rail. */
  log: LogTurn[];
  /** The current streaming assistant reply (for the rail + captions). */
  partialReply: string;
  /** The current streaming user transcription (live caption). */
  interim: string;
  /** Approximate total tokens this session (from usageMetadata). */
  tokens: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Send a typed message (interrupts any in-flight reply). */
  sendText: (text: string) => void;
  /** Clear the conversation log (New conversation). */
  clearLog: () => void;
}

export function useLiveSession(options: UseLiveSessionOptions = {}): UseLiveSession {
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [log, setLog] = useState<LogTurn[]>([]);
  const [partialReply, setPartialReply] = useState('');
  const [interim, setInterim] = useState('');
  const [tokens, setTokens] = useState(0);

  const systemPromptRef = useRef<string | null>(options.systemPrompt ?? null);
  useEffect(() => {
    systemPromptRef.current = options.systemPrompt ?? null;
  }, [options.systemPrompt]);

  // ---- Live session + audio graph refs ------------------------------------
  const sessionRef = useRef<Session | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  // Next time (in output AudioContext clock) at which to schedule a chunk.
  const playheadRef = useRef(0);
  // Output source nodes scheduled but not yet finished — tracked so a barge-in
  // can actually stop in-flight audio (resetting the playhead alone doesn't).
  const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);
  // Guards against late callbacks after a disconnect.
  const closedRef = useRef(false);

  // ---- Telemetry refs (observational, mirror useVoiceAgent's pattern) -----
  const traceRef = useRef<TraceEvent[]>([]);
  const statusRef = useRef<LiveStatus>('idle');
  // When the user most recently stopped speaking (anchors turn-total).
  const speechEndAtRef = useRef(0);
  // Whether first audio-out of the current turn has been recorded.
  const turnTotalRecordedRef = useRef(false);
  const tokensRef = useRef(0);

  // ---- Conversation-log refs (build user/assistant turns from transcription) -
  const logRef = useRef<LogTurn[]>([]);
  const pendingUserRef = useRef('');
  const pendingAssistantRef = useRef('');

  const pushTrace = useCallback((ev: TraceEvent) => {
    traceRef.current = [...traceRef.current, ev];
    setTrace(traceRef.current);
  }, []);

  // Transition the public status AND emit a `state` trace event (machine
  // 'turn', matching Classic) so the DevPanel timeline renders identically.
  const transitionTo = useCallback(
    (next: LiveStatus) => {
      const from = statusRef.current;
      if (from === next) return;
      statusRef.current = next;
      setStatus(next);
      // Only emit machine-comparable states (skip connecting/error in the
      // turn timeline so it reads idle->listening->thinking->speaking).
      const comparable: LiveStatus[] = ['idle', 'listening', 'thinking', 'speaking'];
      if (comparable.includes(from) && comparable.includes(next)) {
        pushTrace({ kind: 'state', machine: 'turn', from, to: next, at: Date.now() });
      }
    },
    [pushTrace]
  );

  // ---- Turn-log commit helpers --------------------------------------------
  // Flush the pending user / assistant transcription into a committed LogTurn.
  // Called when the speaking role switches, on turnComplete, on barge-in, and on
  // disconnect — so the look-back transcript stays complete and ordered.
  const commitUserTurn = useCallback(() => {
    const text = pendingUserRef.current.trim();
    pendingUserRef.current = '';
    setInterim('');
    if (!text) return;
    const turn: LogTurn = { id: crypto.randomUUID(), role: 'user', text };
    logRef.current = [...logRef.current, turn];
    setLog(logRef.current);
  }, []);

  const commitAssistantTurn = useCallback(() => {
    const text = pendingAssistantRef.current.trim();
    pendingAssistantRef.current = '';
    setPartialReply('');
    if (!text) return;
    const turn: LogTurn = { id: crypto.randomUUID(), role: 'assistant', text };
    logRef.current = [...logRef.current, turn];
    setLog(logRef.current);
  }, []);

  // ---- Teardown -----------------------------------------------------------
  const teardownAudio = useCallback(() => {
    try {
      processorRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (inputCtxRef.current && inputCtxRef.current.state !== 'closed') {
      void inputCtxRef.current.close();
    }
    if (outputCtxRef.current && outputCtxRef.current.state !== 'closed') {
      void outputCtxRef.current.close();
    }
    processorRef.current = null;
    sourceNodeRef.current = null;
    micStreamRef.current = null;
    inputCtxRef.current = null;
    outputCtxRef.current = null;
    scheduledNodesRef.current = [];
    playheadRef.current = 0;
  }, []);

  const disconnect = useCallback(() => {
    closedRef.current = true;
    // Save any in-flight partial turns so the look-back transcript is complete.
    commitUserTurn();
    commitAssistantTurn();
    try {
      sessionRef.current?.close();
    } catch {
      /* ignore */
    }
    sessionRef.current = null;
    teardownAudio();
    transitionTo('idle');
  }, [teardownAudio, transitionTo, commitUserTurn, commitAssistantTurn]);

  // ---- Playback: schedule a base64 PCM@24k chunk on the output context ----
  const enqueueAudio = useCallback((base64: string) => {
    if (closedRef.current) return;
    let ctx = outputCtxRef.current;
    if (!ctx) {
      ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      outputCtxRef.current = ctx;
      playheadRef.current = ctx.currentTime;
    }
    const samples = base64PCM16ToFloat32(base64);
    if (samples.length === 0) return;
    const buffer = ctx.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, playheadRef.current);
    node.start(startAt);
    playheadRef.current = startAt + buffer.duration;
    // Track the node so a barge-in can stop it; drop it once it finishes.
    scheduledNodesRef.current.push(node);
    node.onended = () => {
      scheduledNodesRef.current = scheduledNodesRef.current.filter((n) => n !== node);
    };
  }, []);

  // Cut off all scheduled/in-flight output audio immediately (barge-in). The
  // `interrupted` server signal means the user is talking over Echo — stop the
  // queued buffers so they actually hear themselves take the floor.
  const stopPlayback = useCallback(() => {
    for (const node of scheduledNodesRef.current) {
      try {
        node.onended = null;
        node.stop();
      } catch {
        /* already stopped/ended */
      }
    }
    scheduledNodesRef.current = [];
    if (outputCtxRef.current) playheadRef.current = outputCtxRef.current.currentTime;
  }, []);

  // ---- Tool calls: model asks to run a function -> exec server-side -> reply
  // Tools (weather / time / web_search) are declared in the locked token config
  // (/api/live-token). Execution runs server-side via /api/tool-exec so the
  // web_search Tavily key never reaches the browser; we hand each result back
  // with sendToolResponse and the model continues its spoken turn.
  const handleToolCall = useCallback(
    async (functionCalls: FunctionCall[]) => {
      if (closedRef.current || !sessionRef.current) return;
      transitionTo('thinking');
      const functionResponses: Array<{
        id?: string;
        name?: string;
        response: Record<string, unknown>;
      }> = [];
      for (const fc of functionCalls) {
        const startedAt = Date.now();
        let result: Record<string, unknown>;
        try {
          const res = await fetch('/api/tool-exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: fc.name, args: fc.args ?? {} }),
          });
          result = res.ok
            ? ((await res.json()) as Record<string, unknown>)
            : { error: `Tool failed (${res.status}).` };
        } catch {
          result = { error: 'Tool request failed.' };
        }
        functionResponses.push({ id: fc.id, name: fc.name, response: result });
        pushTrace({
          kind: 'tool_exec',
          id: fc.id ?? crypto.randomUUID(),
          name: fc.name ?? 'tool',
          args: fc.args ?? {},
          startedAt,
          endedAt: Date.now(),
          ok: !(typeof result === 'object' && 'error' in result),
          rawResult: result,
        });
      }
      if (closedRef.current || !sessionRef.current) return;
      try {
        sessionRef.current.sendToolResponse({ functionResponses });
      } catch {
        /* socket closing — ignore */
      }
    },
    [pushTrace, transitionTo]
  );

  // ---- Incoming server messages -------------------------------------------
  const handleMessage = useCallback(
    (msg: LiveServerMessage) => {
      if (closedRef.current) return;

      // Tool call from the model: run it server-side, reply via sendToolResponse.
      const toolCalls = msg.toolCall?.functionCalls;
      if (toolCalls && toolCalls.length > 0) {
        void handleToolCall(toolCalls);
      }

      const content = msg.serverContent;
      const parts = content?.modelTurn?.parts ?? [];
      let gotAudio = false;
      for (const part of parts) {
        const data = part.inlineData?.data;
        if (data && part.inlineData?.mimeType?.startsWith('audio/')) {
          gotAudio = true;
          enqueueAudio(data);
        }
      }

      if (gotAudio) {
        // First audio out of the turn -> we're "speaking"; record turn-total
        // (user-speech-end -> first audio) the same way Classic does.
        if (!turnTotalRecordedRef.current && speechEndAtRef.current) {
          turnTotalRecordedRef.current = true;
          pushTrace({
            kind: 'stage',
            id: crypto.randomUUID(),
            label: 'turn-total',
            startedAt: speechEndAtRef.current,
            endedAt: Date.now(),
          });
        }
        transitionTo('speaking');
      }

      // Streaming transcription -> build the conversation log (both sides).
      // When the speaking role switches, the other side's pending turn is done.
      const inText = content?.inputTranscription?.text;
      if (inText) {
        if (pendingAssistantRef.current) commitAssistantTurn();
        pendingUserRef.current += inText;
        setInterim(pendingUserRef.current);
      }
      const outText = content?.outputTranscription?.text;
      if (outText) {
        if (pendingUserRef.current) commitUserTurn();
        pendingAssistantRef.current += outText;
        setPartialReply(pendingAssistantRef.current);
      }

      // Token accounting (no $ for audio per §9 — show tokens/TPM headroom).
      const usage = msg.usageMetadata;
      if (usage?.totalTokenCount) {
        tokensRef.current = usage.totalTokenCount;
        setTokens(usage.totalTokenCount);
        pushTrace({
          kind: 'model_call',
          id: crypto.randomUUID(),
          phase: 'live-turn',
          model: LIVE_MODEL,
          startedAt: speechEndAtRef.current || Date.now(),
          endedAt: Date.now(),
          tokensIn: usage.promptTokenCount ?? 0,
          tokensOut: usage.responseTokenCount ?? 0,
          // No $ rate for audio models — devtrace.estimateCostUsd returns 0 and
          // DevPanel shows "no $ rate" via hasPricing(). Intentional (§9).
          costUsd: 0,
        });
      }

      // Turn boundary: model finished -> back to listening for the next turn.
      if (content?.turnComplete) {
        commitUserTurn();
        commitAssistantTurn();
        turnTotalRecordedRef.current = false;
        transitionTo('listening');
      }
      // Interrupted (barge-in): cut off in-flight audio immediately so the user
      // can actually talk over Echo, then return to listening.
      if (content?.interrupted) {
        // Save the partial reply (what Echo said before being cut off).
        commitAssistantTurn();
        stopPlayback();
        transitionTo('listening');
      }
    },
    [enqueueAudio, stopPlayback, pushTrace, transitionTo, handleToolCall, commitUserTurn, commitAssistantTurn]
  );

  // ---- Send a typed message (interrupts any in-flight reply) ---------------
  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || closedRef.current || !sessionRef.current) return;
      // Sending interrupts: cut in-flight audio + save the partial reply.
      stopPlayback();
      commitAssistantTurn();
      // Commit any pending spoken user text, then log the typed text directly
      // (typed input doesn't echo back via inputTranscription).
      commitUserTurn();
      const turn: LogTurn = { id: crypto.randomUUID(), role: 'user', text: trimmed };
      logRef.current = [...logRef.current, turn];
      setLog(logRef.current);
      transitionTo('thinking');
      try {
        sessionRef.current.sendClientContent({ turns: trimmed, turnComplete: true });
      } catch {
        /* socket closing — ignore */
      }
    },
    [stopPlayback, commitAssistantTurn, commitUserTurn, transitionTo]
  );

  // ---- Clear the conversation log (New conversation) ----------------------
  const clearLog = useCallback(() => {
    logRef.current = [];
    pendingUserRef.current = '';
    pendingAssistantRef.current = '';
    setLog([]);
    setInterim('');
    setPartialReply('');
  }, []);

  // ---- Mic capture: stream PCM16@16k to the session -----------------------
  const startMicCapture = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;
    const ctx = new AudioContext();
    inputCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    sourceNodeRef.current = source;

    // ScriptProcessor is deprecated but universally available and needs no
    // separate worklet-module file — adequate for a 16 kHz mono mic stream.
    // (An AudioWorklet is the lower-jitter upgrade; noted as a TODO.)
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (closedRef.current || !sessionRef.current) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm = downsampleTo16k(input, ctx.sampleRate);
      const data = float32ToBase64PCM16(pcm);
      try {
        sessionRef.current.sendRealtimeInput({
          audio: { data, mimeType: INPUT_MIME_TYPE },
        });
      } catch {
        /* socket may be closing — ignore */
      }
      // Telemetry: while audio flows and we're idle/listening, the user is
      // (likely) speaking; the model's VAD decides turn boundaries server-side.
      if (statusRef.current === 'listening') {
        speechEndAtRef.current = Date.now();
      }
    };

    source.connect(processor);
    // ScriptProcessor only fires onaudioprocess when connected to a
    // destination; route it to a muted gain so it pumps without feedback.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    processor.connect(sink);
    sink.connect(ctx.destination);
  }, []);

  // ---- Connect (explicit user action only) --------------------------------
  const connect = useCallback(async () => {
    if (sessionRef.current || statusRef.current === 'connecting') return;
    setError(null);
    // Fresh telemetry + transcription buffers per session; keep the log so a
    // reconnect continues the same conversation (New conversation clears it).
    traceRef.current = [];
    setTrace([]);
    pendingUserRef.current = '';
    pendingAssistantRef.current = '';
    setInterim('');
    setPartialReply('');
    turnTotalRecordedRef.current = false;
    speechEndAtRef.current = 0;
    closedRef.current = false;
    setStatus('connecting');
    statusRef.current = 'connecting';

    try {
      // 1. Mint an ephemeral token server-side (raw key never ships).
      const res = await fetch('/api/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: systemPromptRef.current }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Token request failed (${res.status}).`);
      }
      const { token } = (await res.json()) as { token: string };
      if (!token) throw new Error('No Live token returned.');

      // 2. Connect directly to Gemini with the ephemeral token as the apiKey.
      // Ephemeral tokens require the v1alpha API surface.
      const ai = new GoogleGenAI({ apiKey: token, apiVersion: 'v1alpha' });
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onopen: () => {
            if (closedRef.current) return;
            transitionTo('listening');
          },
          onmessage: handleMessage,
          onerror: (e: ErrorEvent) => {
            if (closedRef.current) return;
            setError(e.message || 'Live socket error.');
            setStatus('error');
            statusRef.current = 'error';
          },
          onclose: () => {
            if (closedRef.current) return;
            // Server-initiated close — tear down cleanly.
            sessionRef.current = null;
            teardownAudio();
            transitionTo('idle');
          },
        },
      });
      sessionRef.current = session;

      // 3. Start streaming the mic.
      await startMicCapture();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect.';
      setError(message);
      setStatus('error');
      statusRef.current = 'error';
      // Clean up any half-open resources.
      try {
        sessionRef.current?.close();
      } catch {
        /* ignore */
      }
      sessionRef.current = null;
      teardownAudio();
    }
  }, [handleMessage, startMicCapture, teardownAudio, transitionTo]);

  // Unmount cleanup — never leak a socket or mic.
  useEffect(() => {
    return () => {
      closedRef.current = true;
      try {
        sessionRef.current?.close();
      } catch {
        /* ignore */
      }
      sessionRef.current = null;
      teardownAudio();
    };
  }, [teardownAudio]);

  return {
    status,
    connected: status !== 'idle' && status !== 'error',
    error,
    trace,
    log,
    partialReply,
    interim,
    tokens,
    connect,
    disconnect,
    sendText,
    clearLog,
  };
}
