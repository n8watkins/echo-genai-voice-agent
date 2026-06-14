# Echo — session handoff

> Zero-context handoff for **Echo**, a realtime voice agent. Read this in full before working. Don't re-ask decisions recorded here. Portfolio-wide context: `../../HANDOFF.md`. Build plan: `../../VOICE_AGENT_PLAN.md`.

## ⚠️ Update — 2026-06-14 (session #2) — read `../../HANDOFF.md` for the full picture
The sections below are from session #1 and are partly stale. Current truth:
- **SHIPPED PUBLIC** at `github.com/n8watkins/echo-genai-voice-agent`; `master` (@ `7d81169`) tracks `origin`, clean. (Ignore older "not pushed / no remote / branch `ui-app-shell-retrofit`" notes below.)
- Local dir is now **`echo/`** (was `voice-agent/`).
- Added on master since: **favicon + OG cards**, a **Gemini model picker** (`MODELS` + server `pickModel` gate in `src/lib/gemini.ts`; shared key = `gemini-3.1-flash-lite` only, rest BYOK-only), and an **"Under the hood" dev panel** (CPU-chip toggle → `src/components/DevPanel.tsx`, telemetry in `src/lib/devtrace.ts`). 44 tests green.
- **🔧 IN FLIGHT — branch `live-mode` (`85236ac`, NOT merged):** an optional **Gemini Live API native-voice engine** alongside the Classic browser pipeline. Build/test/lint green (49 tests), Classic untouched, but **QA found 2 fixes needed** — see Next Steps #1 in `../../HANDOFF.md` (continuous mic streaming in `src/hooks/useLiveSession.ts:280`; clearer "Start conversation" CTA). To continue: `git checkout live-mode`. **Needs manual Chrome+mic QA before merge.**

## What this is
Talk to an AI and it talks back — streamed, interruptible, with tools. The thesis (and blog): *the model was the easy part; the 800 milliseconds were the hard part.*

- **Stack:** Next.js 16 / React 19 / TS / Tailwind v4; `@google/genai` (`gemini-3.1-flash-lite`, configurable `ECHO_MODEL`).
- **Voice is browser-side:** Web Speech API `SpeechRecognition` (STT) + `speechSynthesis` (TTS). Server only streams the model's text over SSE (`src/app/api/chat/route.ts`).
- **Pipeline:** STT → SSE tokens → `SentenceChunker` (speak-as-you-stream) → TTS queue, driven by a pure turn-taking state machine (`src/lib/conversation/turnMachine.ts`).
- **Tools:** `get_current_time`, `get_weather` (Open-Meteo, keyless), `web_search` (Google PSE, degrades gracefully).
- **Port 3200.** `npm run dev` / `npm run build` / `npm test` / `npm run lint`.

## Features
App-shell UI — **top bar** (persona switcher, **Conversation | Push** mode toggle, compact voice select, usage pill, settings gear, about), **left conversation rail**, **bottom mic/text dock**, **settings drawer**. Plus: 6 **personas** (prompt + matched voice + starter prompts), voice-quality upgrade (prefers neural/online voices), optional **Picovoice wake-word** ("Computer", env-gated via `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY`), BYOK + demo pool.

## State (verified this session)
- Branch **`ui-app-shell-retrofit`**, commits **`d321cfb`** (P0) + **`cc4429e`** (P1) (+ a docs commit adding this file). Working tree clean. **No remote; not pushed.**
- `tsc --noEmit` ✅ · `eslint .` ✅ · `npm run build` ✅ · `npm test` ✅ **35/35**.
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
1. **(User-gated)** merge `ui-app-shell-retrofit` → default branch; add a remote + push if wanted.
2. **Manual Chrome QA** (headphones): mic capture, persona voice matching, hands-free not self-interrupting, mode toggle mid-conversation, headset banner persistence, wake-word ("Computer") with a Picovoice key. Tune the two constants above if barge-in feels too eager/sluggish.
3. **Deploy** (Render free tier; spin-down + ephemeral disk caveats are in the README) and fill the TODO live-demo URL.
4. **Feature queue (deferred, in priority order):** HD voice via Gemini TTS (`generateContent`, BYOK-gated) → shareable session recordings/transcripts → model picker incl. Claude (needs an Anthropic key/cost) → MCP server on Vercel (`mcp-handler`, Streamable HTTP) exposing Echo's tools.

## File map
- `src/hooks/useVoiceAgent.ts` — orchestrator: STT → SSE → chunker → TTS, turn machine, barge-in/mitigation. **Tunables at top.**
- `src/hooks/useSpeechRecognition.ts` (STT + `pause/resume`) · `src/hooks/useSpeech.ts` (TTS queue + voice quality scoring).
- `src/lib/conversation/{turnMachine,sentenceChunker,tools,prompts}.ts` — state machine, speak-as-you-stream, tools, prompts.
- `src/lib/personas.ts` + `src/hooks/usePersona.ts` — the 6 personas.
- `src/app/api/chat/route.ts` — SSE + function-calling loop + input caps. `src/app/api/usage/route.ts` — 250/day cap.
- `src/app/page.tsx` — app-shell composition.
- `src/components/{PersonaSwitcher,ModeToggle,VoiceQuickSelect,ChatRail,SettingsDrawer,HeadsetTip,VoiceOrb,MicButton,WakeWordToggle}.tsx` — UI.
- `docs/blog/the-800ms-problem.md` (build log) · `docs/blog/lessons-and-the-near-future-of-voice.md` (reflection).
- `*.test.ts` (Vitest) · `eslint.config.mjs`.
