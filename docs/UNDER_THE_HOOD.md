# "Under the Hood" — Echo dev-panel design spec

> Echo-scoped extract of the original cross-app design (Scout + Echo). Only the
> Echo-relevant parts are kept here; Scout's half lives in Scout's repo. This is
> the **source of truth that Echo's code comments reference by section** —
> `src/lib/devtrace.ts` (§3, §6, §9), `src/lib/live.ts` (§4d),
> `src/app/api/live-token/route.ts` (§4d), `src/hooks/useLiveSession.ts` (§4d),
> `src/components/EngineToggle.tsx` (§4d), `src/components/DevPanel.tsx` (§4).
>
> Status: **built and merged** (Phases 1–3; see §8). Phase 4 polish is tracked in
> `HANDOFF.md` "Next steps". Written 2026-06-14; Echo-scoped 2026-06-20.

## 1. The idea

Echo presents a clean end-user product (you talk, it talks back). The
*interesting* part for a technical portfolio is the machinery underneath — model
calls, tool invocations, token spend, the latency budget — which is otherwise
invisible. The **"Under the Hood" toggle** (CPU-chip in the top bar) flips Echo
into an *X-ray mode* that exposes the live infrastructure as the demo, without
changing the normal product UX when it's off. Two pillars:

1. **Observability** — show the real API calls, model decisions, tokens, latency,
   and (for text models) cost as they happen.
2. **Swappable infrastructure** — *same UI, different engine underneath*: switch
   the voice backend between the hand-built browser pipeline (Classic) and
   Gemini's native **Live API** (Live), side by side, so a viewer can watch the
   tradeoff.

This reinforces Echo's thesis: "the model was easy, the 800ms were hard."

## 2. Principles

- **Opt-in, zero-regression.** Off by default; the normal product is untouched. A
  top-bar toggle reveals a collapsible panel.
- **Real, not faked.** Every number is measured from an actual call — token
  counts from `usageMetadata`, latency from real timestamps, cost from a real
  pricing table (§6). No mock data.
- **Reuse the streams we already have.** Echo already drives a turn-state machine;
  we *enrich* those events with telemetry rather than building a parallel system.
- **Cheap to run.** Telemetry adds no extra model calls (it piggybacks on calls
  already made). The Live API swap is gated behind a click so idle visitors don't
  burn the audio-token budget.

## 3. Telemetry model (`src/lib/devtrace.ts`)

One entry per model/tool/audio operation, recorded as a turn runs and rendered by
`DevPanel`:

```ts
type TraceEvent =
  | { kind: 'model_call'; id: string; phase: string;        // e.g. 'chat-turn'
      model: string; startedAt: number; endedAt: number;
      tokensIn: number; tokensOut: number; costUsd: number;  // cost via §6 table
      prompt?: string; rawResponse?: string;                  // behind a "show raw" accordion
      toolCall?: { name: string; args: unknown } | null }
  | { kind: 'tool_exec'; id: string; name: string;            // 'web_search' | 'get_weather' | 'get_current_time'
      args: unknown; startedAt: number; endedAt: number;
      ok: boolean; rawResult?: unknown }                      // raw provider result, pre-summarization
  | { kind: 'stage'; id: string; label: string;               // pipeline stage marker (latency budget)
      startedAt: number; endedAt: number }                    // 'stt' | 'model-first-token' | 'model-complete' | 'tts-sentence-N' | 'turn-total'
  | { kind: 'state'; machine: 'turn' | 'react'; from: string; to: string; at: number };
```

- **Token counts**: Gemini responses carry `usageMetadata` (`promptTokenCount`,
  `candidatesTokenCount`, `totalTokenCount`); for streams it arrives on the final
  chunk. Capture it where each call resolves.
- **Cost**: `costUsd = tokensIn/1e6 * inRate + tokensOut/1e6 * outRate` using §6
  (text models only; see `estimateCostUsd` / `hasPricing`).
- **Rendering**: `<DevPanel events={TraceEvent[]} />` renders a **latency
  waterfall** (horizontal bars on a time axis, colored by kind) plus an
  expandable list (click a bar → see prompt/response/tokens/cost/tool I/O).

## 4. Echo — the high-value case

Echo's pipeline is invisible by default; this is where X-ray mode earns its keep.

**4a. Latency waterfall (the "800ms budget" made literal).** `stage` events around
each segment of a turn:
- `stt` — speech-end → final transcript (`useSpeechRecognition`)
- `model-first-token` — request sent → first SSE token (`useVoiceAgent` fetch loop)
- `model-complete` — first → last token
- `tts-sentence-N` — each `SentenceChunker` flush → `speechSynthesis` start (the speak-as-you-stream win)
- `turn-total` — speech-end → first audio out (the headline number)
Rendered as a stacked timeline per turn so a viewer *sees* where the ms go.

**4b. Turn-machine state timeline.** `turnMachine.ts` has explicit states; emit
`state` transitions and draw them under the waterfall (idle → listening →
thinking → speaking → …), including barge-in/interrupt events.

**4c. Token stream + tool calls.** Show streaming tokens live, and each function
call (`get_weather` / `get_current_time` / `web_search`) with its raw result
before the model phrases it.

**4d. Swappable voice infrastructure ("same UI, different engine").** A backend
switch (`EngineToggle.tsx`) with live metric comparison:
- **Mode A — Classic (current default):** Web Speech STT + `generateContentStream`
  text + `speechSynthesis` TTS. Free; the portfolio thesis.
- **Mode B — Live (native audio):** `ai.live.connect()` with
  `gemini-3.1-flash-live-preview`. **Confirmed free on the current key (§7).**
- The panel shows the *same* turn-total/latency/quality metrics for whichever mode
  is active, so the comparison is concrete. Framing: "I built the realtime
  pipeline by hand to learn where the 800ms goes — here's the same agent on
  Google's managed Live API, and here's the tradeoff."
- **Live architecture:** `src/app/api/live-token/route.ts` mints an **ephemeral
  token** (`ai.authTokens.create`, scoped to the Live model + AUDIO modality); the
  browser connects **directly** to Gemini over WebSocket (no proxy, lowest
  latency) via `ai.live.connect`. Raw key never ships to the client. Mode B is
  gated behind an explicit **Connect** click (TPM budget, §7). PCM is 16 kHz in /
  24 kHz out (`src/lib/live.ts`).

**Touch-points (as built):** `src/hooks/useVoiceAgent.ts` + `useSpeechRecognition.ts`
+ `useSpeech.ts` (stage/state/token events), `src/lib/conversation/turnMachine.ts`
(state events), `src/app/api/chat/route.ts` (token/cost per call),
`src/app/api/live-token/route.ts` (ephemeral token), `src/hooks/useLiveSession.ts`
(Live engine), `src/components/DevPanel.tsx` + top-bar toggle.

## 6. Cost-estimate table (per 1M tokens, paid rates; verified 2026-06-14)

Used only for the *estimated cost* readout (the demo is on the free tier, so this
is illustrative "what this would cost at scale"). Mirrored in
`MODEL_PRICING` in `src/lib/devtrace.ts`.

| Model | in | out |
|---|---|---|
| gemini-3.1-flash-lite | $0.25 | $1.50 |
| gemini-2.5-flash-lite | $0.10 | $0.40 |
| gemini-2.5-flash | $0.30 | $2.50 |
| gemini-3-flash-preview | $0.50 | $3.00 |
| gemini-3.5-flash | $1.50 | $9.00 |
| Live API audio (in/out) | unconfirmed — Live mode reports tokens + TPM headroom, NOT $ (§9) |

## 7. Live API free-tier verification (probe, 2026-06-14)

A throwaway probe against the current `GEMINI_API_KEY` confirmed:
- `generateContent` on `gemini-3.1-flash-lite` → success (key is on a working free tier).
- `models.list` → 55 models, incl. `gemini-3.1-flash-live-preview`,
  `gemini-2.5-flash-native-audio-{latest,preview-09-2025,preview-12-2025}`,
  `gemini-3.5-live-translate-preview`, `gemini-3.1-flash-tts-preview`.
- **Opened real Live WebSocket sessions** on `gemini-3.1-flash-live-preview` and
  `gemini-2.5-flash-native-audio-preview-12-2025`, sent text, **received AUDIO
  frames** — no billing error.
- **Conclusion: Live API audio is usable on the free tier.** The ceiling is
  **TPM** (flash-live ≈ 65K tokens/min; audio counts as tokens) shared across
  concurrent visitors → fine for a demo, throttles under heavy simultaneous load.
  Mitigation: gate Live mode behind an explicit Connect click. Token minted
  demo-key-only for now (BYOK-for-Live is a later concern).

## 8. Build phases (status as of 2026-06-14)

1. ✅ **DONE (merged)** — **Echo telemetry panel**: `TraceEvent` model + `DevPanel`
   + latency waterfall / token stream / tool calls / turn-state. (echo `7d81169`)
2. — (Scout dev panel; tracked in Scout's repo, not Echo.)
3. ✅ **DONE (merged)** — **Echo Live-API voice swap**: ephemeral-token route +
   `ai.live.connect()` native-audio Mode B + engine toggle + side-by-side
   telemetry. Barge-in stops in-flight audio on `interrupted`
   (`useLiveSession.ts` `stopPlayback()`) + clear "Start conversation" CTA.
   Build/test/lint green. **Merged before manual QA (user's call) — Chrome+mic QA
   still owed; see `QA_TESTING.md`.**
4. ⏳ **Pending — Polish** (also in `HANDOFF.md` next-steps): Live-mode
   AudioWorklet (replace `ScriptProcessorNode` in `useLiveSession.ts`), dev-panel
   persistence + mobile layout, refined readouts.

## 9. Decisions (resolved 2026-06-14)

- **Panel placement/shape** — collapsible in-app panel *alongside* the product
  (reinforcing "same UI"), not a separate route.
- **Raw prompt/response exposure** — fully visible, but inside **accordions**
  (default collapsed, expand on demand) since screen space is tight.
- **Live mode scope** — start with `gemini-3.1-flash-live-preview` (a voice
  model: live probe returned audio; note it's flash-**live**, distinct from
  flash-**lite**). Native Audio Dialog is the fallback/upgrade. All Live models
  confirmed free (unlimited RPM/RPD, TPM-capped).
- **Cost readout** — text models show an estimated $ (table §6). **Live/audio mode
  shows tokens + TPM headroom, NOT a $ figure** (audio pricing unconfirmed; the
  demo is free within TPM anyway).
</content>
</invoke>
