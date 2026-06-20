# Echo — session handoff

> Zero-context handoff for **Echo**, a realtime voice agent. Read this in full before working. Don't re-ask decisions recorded here. Build plan: `VOICE_AGENT_PLAN.md` (this folder).

## ✅ Audit reconciliation — 2026-06-20
Re-verified this handoff against the actual repo (git log/branch + file/test checks). Findings folded in below. Headline corrections:
- **Real current HEAD is `bb979a5`** ("docs: mark Live mode merged in handoff (session #2 wrap)") — the session-#2 banner's "`master` (@ `8bb97ac`)" was one docs commit stale. All other cited hashes (`7d81169`, `8bb97ac`, `11774f2`, `0a31862`) are real and accurate.
- **`live-mode` branch is fully merged into `master` and gone** (merge `11774f2`); only `master` + a long-merged local `ui-app-shell-retrofit` remain. The Live engine is **merged, not in flight** — any "in flight / unmerged" note (incl. in the root handoff) is stale.
- **Tests = 49 passing** (4 files: `devtrace`, `live`, `sentenceChunker`, `turnMachine`). The session-#1 "State" section below says "35/35" — that was true then; **49 is current**.
- **All named files exist** (verified): `src/hooks/{useLiveSession,useVoiceEngine,useVoiceAgent,useSpeechRecognition,useSpeech}.ts`, `src/app/api/{live-token,chat,usage}/route.ts`, `src/lib/{live,gemini,devtrace}.ts`, `src/components/{EngineToggle,DevPanel,ModelPicker}.tsx`, `docs/VOICE_AGENT_PLAN.md`.
- **Doc reorg:** the build plan now lives in this repo at `docs/VOICE_AGENT_PLAN.md` (moved out of the portfolio root); the pointer above is updated. `QA_TESTING.md` stays at the portfolio root (`../../QA_TESTING.md` resolves correctly from here).
- **Still open / NOT done:** manual Chrome+mic QA of **both** Live mode and Classic voice (merged un-QA'd by the user's call). Deploy + live-demo URL still TODO.

## ⚠️ Update — 2026-06-14 (session #2)
The sections below are from session #1 and are partly stale. Current truth:
- **SHIPPED PUBLIC** at `github.com/n8watkins/echo-genai-voice-agent`; `master` tracks `origin`, clean. (Audit 2026-06-20: real HEAD is `bb979a5`; the original "@ `8bb97ac`" here was one commit behind.) Ignore older "not pushed / no remote / branch `ui-app-shell-retrofit`" notes in the session-#1 "State" section below — they are superseded: the app is public and `ui-app-shell-retrofit` is long merged.
- Local dir is now **`echo/`** (was `voice-agent/`).
- Added on master since: **favicon + OG cards**, a **Gemini model picker** (`MODELS` + server `pickModel` gate in `src/lib/gemini.ts`; shared key = `gemini-3.1-flash-lite` only, rest BYOK-only), an **"Under the hood" dev panel** (CPU-chip toggle → `src/components/DevPanel.tsx`, telemetry in `src/lib/devtrace.ts`), and README + lessons-blog sync.
- **✅ MERGED — native Gemini Live API voice engine** ("Live" vs "Classic" via a top-bar `EngineToggle`): ephemeral token (`src/app/api/live-token/route.ts`) → direct browser↔Gemini WebSocket → native PCM audio + server-side VAD/barge-in. Model `LIVE_MODEL` (`gemini-3.1-flash-live-preview`) in `src/lib/live.ts`. Engine in `src/hooks/useLiveSession.ts` (barge-in stops in-flight audio via `stopPlayback()` on `interrupted`); Classic path (`useVoiceAgent`) untouched + still the default. 49 tests green. **Merged before manual QA (user's call) — still needs a Chrome+mic QA pass; see `../../QA_TESTING.md` (Live-mode barge-in is the top item).**
  - **Verified free via a live probe (2026-06-14):** the Gemini Live API streams audio on the shared key — `gemini-3.1-flash-live-preview` returned audio with no billing error (ceiling = TPM, ~65K/min for flash-live; audio counts as tokens). Token minted demo-key-only for now.
  - **QA-tuning lever if barge-in/turn-taking feels off:** tune `realtimeInputConfig.automaticActivityDetection` sensitivity in `connect()`'s session config inside `useLiveSession.ts`. (Classic-mode levers are `BARGE_IN_COOLDOWN_MS` / `MIN_BARGE_IN_CHARS` in `useVoiceAgent.ts`.)

## What this is
Talk to an AI and it talks back — streamed, interruptible, with tools. The thesis (and blog): *the model was the easy part; the 800 milliseconds were the hard part.*

- **Stack:** Next.js 16 / React 19 / TS / Tailwind v4; `@google/genai` (`gemini-3.1-flash-lite`, configurable `ECHO_MODEL`).
- **Voice is browser-side:** Web Speech API `SpeechRecognition` (STT) + `speechSynthesis` (TTS). Server only streams the model's text over SSE (`src/app/api/chat/route.ts`).
- **Pipeline:** STT → SSE tokens → `SentenceChunker` (speak-as-you-stream) → TTS queue, driven by a pure turn-taking state machine (`src/lib/conversation/turnMachine.ts`).
- **Tools:** `get_current_time`, `get_weather` (Open-Meteo, keyless), `web_search` (Google PSE, degrades gracefully).
- **Port 3200.** `npm run dev` / `npm run build` / `npm test` / `npm run lint`.

## Features
App-shell UI — **top bar** (persona switcher, **Conversation | Push** mode toggle, compact voice select, usage pill, settings gear, about), **left conversation rail**, **bottom mic/text dock**, **settings drawer**. Plus: 6 **personas** (prompt + matched voice + starter prompts), voice-quality upgrade (prefers neural/online voices), optional **Picovoice wake-word** ("Computer", env-gated via `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY`), BYOK + demo pool.

## State (session #1 snapshot — partly superseded; see the 2026-06-20 audit + session-#2 notes at top)
- ~~Branch **`ui-app-shell-retrofit`**, commits **`d321cfb`** (P0) + **`cc4429e`** (P1)~~. **Audit 2026-06-20:** stale — that branch is fully merged into `master` (HEAD `bb979a5`); the app is shipped public with a remote. `d321cfb`/`cc4429e` are still in history.
- `tsc --noEmit` ✅ · `eslint .` ✅ · `npm run build` ✅ · `npm test` ✅ ~~**35/35**~~ → **49/49** (current, audit 2026-06-20).
- **Hands-free + barge-in is the DEFAULT** (decided by the user). Self-interrupt is mitigated for real: the recognizer is **paused while Echo speaks**, with a **600ms post-TTS cooldown** and a **min interim length** before a barge-in counts — `src/hooks/useVoiceAgent.ts` + `pause()`/`resume()` in `src/hooks/useSpeechRecognition.ts`. Push-to-talk is the alternative mode.
- Demo pool **250 model-calls/day** (counted per `generateContentStream` call incl. tool rounds, BYOK bypasses) — `src/app/api/usage/route.ts`. Server-side input caps in `src/app/api/chat/route.ts` (message ≤4000, history clamped).
- Lint is real now (flat `eslint.config.mjs`; `next lint` was removed in Next 16). Vitest covers `transition()` + `SentenceChunker`. Dead code removed; `MicButton` has a real `size` prop; focus traps on `SettingsDrawer` + mobile `ChatRail`; Porcupine `.pv` is gitignored (download step in README + `.env.example`).

## Gotchas (hard-won)
- **Web Speech API is Chrome/Edge-only**, effectively unsupported on iOS Safari → the **text input is first-class**, not a courtesy. A reviewer on Firefox/iPhone still gets a working typed demo.
- **The mic hears Echo's own TTS** (physics, no raw stream from the Web Speech API to apply echo cancellation) → **headphones recommended**; the chosen fix is pausing the recognizer during speech, so *true mid-sentence* voice barge-in is limited (interruption works as the queue drains, via tap-to-stop, or in push-to-talk). This is stated honestly in all docs.
- **Gemini 3 thoughtSignature** must be preserved on tool round-trips (collect `modelParts` verbatim) — see `src/app/api/chat/route.ts`.
- 250 cap is **per-process/in-memory** (resets on cold start); Upstash is the durable upgrade.
- Tunables live at the top of `useVoiceAgent.ts`: `BARGE_IN_COOLDOWN_MS`, `MIN_BARGE_IN_CHARS`.

## Next steps (ordered)
> **Audit 2026-06-20:** the original step 1 ("merge `ui-app-shell-retrofit` + add a remote") is **DONE** — app is shipped public, `ui-app-shell-retrofit` is merged. Reordered below.
1. **(FOCUS) Manual Chrome+mic QA — both engines** (Live merged un-QA'd by the user's call). **Top item: Live-mode barge-in** — toggle → Live → "Start conversation" → talk over Echo and confirm its audio cuts off (the `interrupted`→`stopPlayback()` path stops scheduled `AudioBufferSourceNode`s in `useLiveSession.ts`); if turn-taking feels off, tune `automaticActivityDetection` (see above). **Classic:** mic capture, persona voice matching, hands-free not self-interrupting (tune `BARGE_IN_COOLDOWN_MS`/`MIN_BARGE_IN_CHARS`), mode toggle mid-conversation, headset banner persistence, wake-word ("Computer") with a Picovoice key. Also exercise the model-picker BYOK flow + the dev panel. Full checklist: **`../../QA_TESTING.md`** (root).
2. **Deploy** to **Render free tier** (spin-down + ephemeral-disk caveats are in the README) → replace the TODO live-demo URL in the README. **Domain DECIDED: `n8builds.dev`**; Echo attaches as a subpath `portfolio.n8builds.dev/echo` (per-app `basePath` + rewrites; SSE/Live may need a subdomain fallback). **The user handles the actual Render deploy.**
3. **Feature queue (deferred, in priority order):** HD voice via Gemini TTS (`generateContent`, BYOK-gated) → shareable session recordings/transcripts → model picker incl. Claude (needs an Anthropic key/cost) → MCP server on Vercel (`mcp-handler`, Streamable HTTP) exposing Echo's tools. *Portfolio decisions (don't re-litigate): HD TTS = **no** (browser TTS is the honest free default); MCP = **deprioritized**; embeddings = **Scout only, Echo skip**.*
4. **Optional infra:** swap Live-mode mic capture from `ScriptProcessorNode` → `AudioWorklet`; Upstash KV for durable demo caps once public; Phase 4 dev-panel polish (panel persistence).

## File map
- `src/hooks/useVoiceAgent.ts` — orchestrator: STT → SSE → chunker → TTS, turn machine, barge-in/mitigation. **Tunables at top.**
- `src/hooks/useSpeechRecognition.ts` (STT + `pause/resume`) · `src/hooks/useSpeech.ts` (TTS queue + voice quality scoring).
- `src/lib/conversation/{turnMachine,sentenceChunker,tools,prompts}.ts` — state machine, speak-as-you-stream, tools, prompts.
- `src/lib/personas.ts` + `src/hooks/usePersona.ts` — the 6 personas.
- `src/app/api/chat/route.ts` — SSE + function-calling loop + input caps. `src/app/api/usage/route.ts` — 250/day cap.
- `src/app/page.tsx` — app-shell composition + engine switch (Classic preserved in the `engine==='classic'` branch).
- `src/components/{PersonaSwitcher,ModeToggle,VoiceQuickSelect,ChatRail,SettingsDrawer,HeadsetTip,VoiceOrb,MicButton,WakeWordToggle}.tsx` — UI.
- **Live mode (Mode B):** `src/hooks/useLiveSession.ts` (Live engine: token → `ai.live.connect()` → PCM in/out + barge-in) · `src/hooks/useVoiceEngine.ts` + `src/components/EngineToggle.tsx` (`classic|live` selector) · `src/app/api/live-token/route.ts` (mints ephemeral token, demo-key-only) · `src/lib/live.ts` (`LIVE_MODEL` + PCM conversion helpers; `live.test.ts`).
- **Model picker:** `src/lib/gemini.ts` (`MODELS` allowlist + server `pickModel(requested, byok)`; `SHARED_MODEL = gemini-3.1-flash-lite` only on the shared key, rest BYOK-only) · `src/components/ModelPicker.tsx`.
- **Dev panel ("Under the hood"):** `src/lib/devtrace.ts` (shared `TraceEvent` telemetry; `devtrace.test.ts`) · `src/components/DevPanel.tsx` (CPU-chip toggle in the top bar; Live should emit the same `TraceEvent`s).
- `docs/blog/the-800ms-problem.md` (build log) · `docs/blog/lessons-and-the-near-future-of-voice.md` (reflection) · `docs/VOICE_AGENT_PLAN.md` (build plan).
- `*.test.ts` (Vitest, 49 tests: `devtrace`, `live`, `sentenceChunker`, `turnMachine`) · `eslint.config.mjs`.
