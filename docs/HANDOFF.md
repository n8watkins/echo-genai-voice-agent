# Echo - session handoff

> Zero-context handoff for **Echo**, a realtime voice agent. Read this in full before working. Don't re-ask decisions recorded here. Build plan: `VOICE_AGENT_PLAN.md` (this folder).

## Current state and open work (2026-10-27): start here

This section is the entry point.
The older sections below are history from June 2026; where they disagree with this section, this section wins.

### What it is and where it lives

Echo is a realtime voice agent: you talk, it streams a reply and speaks it, you can interrupt, and it can call tools (weather, time, Tavily web search).
It has two voice engines: Classic (browser speech-to-text, streamed Gemini text, browser text-to-speech) and Live (Gemini's native Live API audio over WebSocket).
Live demo: https://echo-kzw1.onrender.com (Render free plan, service `echo-genai-voice-agent`).
It is listed on the owner's portfolio, https://portfolio.n8builds.dev, which shows OpenPing's live status next to it.
Repo: `n8watkins/echo-genai-voice-agent` (default branch `master`), MIT license as of 2026-10-27.

### Status as of 2026-10-27

- Live and current: Render auto-deployed `9da3b84` (the em dash fix, PR #2) on 2026-10-28 UTC.
  The page title is now "Echo - Realtime Voice Agent".
- `/api/healthz` returns `{"status":"ok","hasDemoKey":true,"model":"gemini-3.1-flash-lite"}`.
- Render free plan: the service sleeps after about 15 minutes idle and a cold start takes about a minute.
  OpenPing measures 90-day uptime at 96.6%.
  Render's event log shows every free service in the workspace suspended for "Free Tier Usage Exceeded" from 2026-07-24 to 2026-08-01, so keeping several free services warm burns the shared 750 instance-hours.
- The service runs Render's native Node runtime with `NODE_VERSION=22` (supported).
- Checks run locally today: lint and type-check clean, `vitest` 49/49 pass.

### Model plan (open PR, do not merge before the key step)

The owner decided on 2026-10-27 to move every Gemini text model to Gemini 3.5 Flash Lite.
The exact ID `gemini-3.5-flash-lite` was confirmed on https://ai.google.dev/gemini-api/docs/models (listed as Stable, on the free tier).

- **Text and tool model: switching.**
  **PR #3** (https://github.com/n8watkins/echo-genai-voice-agent/pull/3) moves `DEFAULT_MODEL` and `SHARED_MODEL` in `src/lib/gemini.ts` to `gemini-3.5-flash-lite`, keeps 3.1 Flash Lite as a BYOK option in the picker, adds its price to the dev panel, and updates README, `.env.example`, `docs/UNDER_THE_HOOD.md` and `docs/QA_TESTING.md`.
  It is intentionally left open, because it can't be verified end to end until the owner's new Gemini key is on Render.
- **Live engine model: not switched, on purpose.**
  `LIVE_MODEL = 'gemini-3.1-flash-live-preview'` in `src/lib/live.ts` is a realtime native-audio model for the Live API, not a text model, and there is no Flash Lite Live model to move to.
  Google's models page now labels it a legacy preview and recommends `gemini-3.8-live`.
  Moving the Live engine is a separate decision for the owner: check the new model's free-tier access on the new key first (the June probe confirmed 3.1 Flash Live was free), then test barge-in and tools in a real mic session.
- **Render env pins the old model.**
  The service has `ECHO_MODEL=gemini-3.1-flash-lite` set, and it overrides the code default, so it must change with the merge.

Order: owner sets the new `GEMINI_API_KEY` on `echo-genai-voice-agent` and changes `ECHO_MODEL` to `gemini-3.5-flash-lite` (or deletes it), then merge PR #3 (squash), then a live check: `/api/healthz` reports `gemini-3.5-flash-lite`, a Classic voice turn and a typed turn that calls a tool both answer, and the Live engine still connects.

### Open problems

1. **Security, HIGH (live public site): Next.js has known critical advisories.**
   `package-lock.json` locks `next` 16.2.9.
   GitHub's advisory database (checked 2026-10-27) lists 5 critical, 6 high, 8 moderate and 1 low advisories for it, including unauthenticated remote code execution in `use cache`, Image Optimization and `next/og` (Echo uses `next/og` for `src/app/opengraph-image.tsx`).
   All are fixed in `next` >= 16.4.1.
   Fix: upgrade `next` (and `eslint-config-next` to match) to the latest 16.x (>= 16.4.1), run `npm run lint`, `npm run type-check`, `npm run build` and `npm test`, merge so Render deploys, then a live check (page, OG image at `/opengraph-image`, a voice turn, sign-in).
2. **A duplicate Render service keeps being created by the Blueprint.**
   Render Blueprint `echo` (`exs-d8riktu7r5hc73eddpmg`) syncs `render.yaml` on every push that changes it.
   `render.yaml` names the service `echo`, but the real service is `echo-genai-voice-agent` and is not managed by that Blueprint, so each sync creates or keeps a separate service called `echo`.
   It happened again on 2026-10-28 06:06 UTC when PR #2 edited comments in `render.yaml`: a new free service `echo` (`srv-dbgp1j1srm7s73eejav0`, https://echo-a8ec.onrender.com) is live with no demo key (`hasDemoKey:false`).
   The June duplicate (`srv-d8rmci6gvqtc73f86ob0`) had the same cause.
   Not fixed in code, because renaming the service in `render.yaml` would make the Blueprint start applying its settings to the live service, which is a hosting change for the owner to decide.
   Reproduce: Render dashboard, Blueprints, `echo`, or list services and look for two Echo services.
3. **Manual in-browser QA is still owed** for both voice engines, sign-in, and saved conversations; see "Next steps" below and `docs/QA_TESTING.md`.
4. **Status display on the portfolio.**
   OpenPing currently shows off-hours (weekend) monitors as "operational"; the fix is tracked in the open-ping repo, not here.

### Blocked on the owner

- Create the new Gemini API key and set it as `GEMINI_API_KEY` on `echo-genai-voice-agent`; change or delete `ECHO_MODEL` there (see "Model plan").
- Delete the duplicate service `echo` (`echo-a8ec.onrender.com`), and fix the Blueprint so it stops recreating it: either delete the `echo` Blueprint (the real service deploys from git on its own), or point it at the real service by renaming the service in `render.yaml` to `echo-genai-voice-agent` and accepting that the Blueprint then manages it.
  Until then, avoid editing `render.yaml`.
- Planned subdomain `echo.n8builds.dev`: add it as a custom domain on the Render service and add the Cloudflare CNAME Render asks for.
  After it resolves, set `NEXT_PUBLIC_APP_URL` and `AUTH_URL` to `https://echo.n8builds.dev` on Render and add `https://echo.n8builds.dev/api/auth/callback/github` to the GitHub OAuth app, or sign-in breaks on the new address.

### Next steps, in order

1. Owner: new key, `ECHO_MODEL`, duplicate service and Blueprint (above).
2. Upgrade `next` to the latest 16.x (open problem 1) in its own PR, verify, deploy, check live.
3. Merge PR #3, then run the live check described in "Model plan".
4. Decide whether to move the Live engine to `gemini-3.8-live` (see "Model plan"), then test it in a real mic session.
5. Manual in-browser QA from `docs/QA_TESTING.md`.
6. When the owner has set up `echo.n8builds.dev`, update the README live-demo link and the `metadataBase` default in `src/app/layout.tsx`.

## 🧭 Session #3 wrap - current state & next move (READ ME FIRST)

**Echo is deployed, live, and feature-complete on both voice engines, with optional GitHub auth + Turso persistence.** New agent: read this file top-to-bottom, then `README.md`. Live: <https://echo-kzw1.onrender.com>. Repo is clean, `master == origin/master` (use `git log` for HEAD).

**This session (#3) shipped** (commits `bbbda0c` → `d169ece`; full detail in the sections below):
- Deployed to **Render** (free tier, in-repo `render.yaml` Blueprint) + live URL.
- `web_search` → **Tavily** (replaced the dormant Google PSE).
- **Live mode now fully works and is at parity with Classic:** fixed the `v1alpha` ephemeral-token 404; function-calling **tools** (weather/time/Tavily via `/api/tool-exec`); two-sided **transcript**, **text input** (sending interrupts), **starter prompts**; shares `LogTurn`/`ChatRail`/`LiveCaptions`.
- **Mobile** responsive pass.
- **GitHub auth (Auth.js v5) + Turso persistence** - optional; sign-in gates saving; signed-out/unconfigured = today's in-memory behavior, unchanged.

**⚠️ In flight at wrap - NOT verified by a human:**
- **Deploy/env-var saga - RESOLVED:** Root cause was a **duplicate Render service**. Env vars were being set on `echo` (`srv-d8rmci6gvqtc73f86ob0`, `echo-2egv.onrender.com`) instead of the real **`echo-genai-voice-agent`** (`srv-d8rj3oegvqtc73f4hq1g`, **`echo-kzw1.onrender.com`** - the README's live URL). All env vars (`GEMINI_API_KEY`/`ECHO_MODEL`/`TAVILY_API_KEY` + `AUTH_GITHUB_*`/`AUTH_SECRET`/`AUTH_URL` + `TURSO_*`) are now set on the **correct** service and **verified live**: `/api/auth/providers` → `github` with callback `https://echo-kzw1.onrender.com/api/auth/callback/github`; `/api/conversations` → `persistence:true`; `/api/healthz` → `hasDemoKey:true`. **`AUTH_URL=https://echo-kzw1.onrender.com` was required** (see Gotchas). **TODO: delete the stray `echo`/`echo-2egv` duplicate service.**
- **ALL in-browser QA is still owed** - no voice / auth / persistence flow has been clicked through by a human. This is the #1 task (Next steps #2 + `QA_TESTING.md`).
- **User to-dos (not the next agent's):** ensure the GitHub OAuth app has the **production** callback `https://echo-kzw1.onrender.com/api/auth/callback/github`; **rotate** the secrets pasted into the session chat (Render API key, Turso token, GitHub client secret).

## 🚀 Deployed - 2026-06-20 (session #3)
**Echo is LIVE on Render (free tier): <https://echo-kzw1.onrender.com>** - `/api/healthz` returns `{status:"ok", hasDemoKey:true, model:"gemini-3.1-flash-lite"}` (verified live).
- **How:** in-repo **`render.yaml` Blueprint** (repo root). Free web service · build `npm install && npm run build` · start `npx next start -p $PORT` (package.json `start` hardcodes 3200, so the `$PORT` override is **mandatory** on Render) · health check `/api/healthz` · Node 22. Dashboard env: `GEMINI_API_KEY` (+ `ECHO_MODEL=gemini-3.1-flash-lite`); `TAVILY_API_KEY`, Picovoice, `NEXT_PUBLIC_APP_URL` left **blank** at first deploy (all optional - `web_search` degrades to model knowledge, wake-word stays disabled, app unaffected). *(`web_search` later switched to Tavily - see the cont. note below.)*
- **Keep-warm reality:** free services spin down after ~15 min idle (~1 min cold start); the **workspace** shares **750 instance-hours/month**. One UptimeRobot HTTP monitor on `…/api/healthz` @ 5 min keeps ONE service warm; 2–3 always-on free services exhaust the 750h in ~10 days - so "all portfolio apps always-on for free" isn't viable (keep one warm + cold-start the rest, or upgrade/Vercel). User is setting up the UptimeRobot monitor.
- **Social-share cards - FIXED:** `metadataBase` in `src/app/layout.tsx` now uses `process.env.NEXT_PUBLIC_APP_URL || 'https://echo-kzw1.onrender.com'` (was hardcoded to `portfolio.n8builds.dev/echo`), so link previews resolve on the live URL. `NEXT_PUBLIC_APP_URL` is now wired into code - set it to override for a future custom domain.
- **Unchanged:** the manual Chrome+mic QA pass is still owed - deploying didn't touch it.
- **Web search → Tavily (session #3, cont.):** swapped the dormant Google-PSE `web_search` impl for **Tavily** (`TAVILY_API_KEY`, an LLM-oriented search API; free ~1k searches/mo at [app.tavily.com](https://app.tavily.com)). Same `web_search` tool *declaration* - only the `tools.ts` dispatcher + env/docs changed; still degrades gracefully with no key. Key set in `.env.local` for local dev; **set `TAVILY_API_KEY` in the Render dashboard** (Environment tab) to enable live search on the deploy. The old `GOOGLE_SEARCH_*` vars are retired everywhere except the historical `VOICE_AGENT_PLAN.md` env block (left as the original plan-time record).
- **Live mode tools - IMPLEMENTED via function calling (session #3, cont.):** Live now has the SAME tools as Classic (weather / time / web_search→Tavily). Path: `functionDeclarations` locked into the live-token config → the model emits `toolCall` → `useLiveSession.handleToolCall` POSTs to **`/api/tool-exec`** (runs the shared server-side `dispatchTool`, so the Tavily key stays server-side) → replies via `session.sendToolResponse` → model continues its spoken turn. Tool calls also emit a `tool_exec` TraceEvent so the dev panel renders them like Classic. Native **googleSearch grounding was rejected first** - it 1011s (needs a paid tier) on the free key; custom function calling works free (probed end-to-end: token-locked tools + tool-less browser config → `toolCall` → `sendToolResponse` → audio round-trip OK). **Still owed: in-browser verification** that Echo speaks tool-grounded answers in a real mic session.
- **Live ↔ Classic chat parity - IMPLEMENTED (session #3, cont.):** Live now builds the SAME `LogTurn[]` Classic uses, from `inputAudioTranscription` + `outputAudioTranscription` (both confirmed free), and feeds the shared `ChatRail`/`ConversationLog`/`LiveCaptions` (`page.tsx` reads `liveMode ? live.* : agent.*`). Added a **text input to the Live dock** (`live.sendText` → `sendClientContent`; **sending interrupts** - no toggle, per the user) and **Live starter prompts** (shown when `live.log` is empty; a click connects then sends as the opening message). Turn-commit logic in `useLiveSession`: flush the other side's pending turn when the speaking role switches, on `turnComplete`, on barge-in (saves the partial reply), and on disconnect (so the log is complete). **Disconnect keeps the log + trace for look-back; New conversation wipes them** - fixes the earlier "state shows but chat is empty" mismatch. Build/type-check/lint/49 tests green; output transcription proven headlessly - **input (user-speech) transcription still needs an in-browser mic test.**
- **Persistence + GitHub auth - IMPLEMENTED (session #3, cont.):** Optional, degrades gracefully (signed-out / unconfigured = today's in-memory behavior). **Auth.js (NextAuth v5):** `src/auth.ts` (GitHub provider, empty when `AUTH_GITHUB_*` unset; `trustHost`; surfaces `session.user.id`), `/api/auth/[...nextauth]`, `Providers` (SessionProvider) in layout, `AuthButton` in the top bar (renders nothing when unconfigured). **Turso/libSQL:** `src/lib/db.ts` (off when `TURSO_*` unset), `src/lib/conversations.ts` data layer, `/api/conversations` + `/api/conversations/[id]` **session-scoped by `session.user.id`** (never trusts the client). Client: `useConversations` + a debounced auto-save of the active `LogTurn[]`; `ChatRail` now shows the saved list + load/delete + a sign-in nudge; a `viewing` state renders a loaded past chat read-only. Verified: build/type-check/lint + `/api/conversations` signed-out → `{persistence:true,signedIn:false}`; Turso round-trip + Auth.js `/api/auth/providers` probed. **Owed:** in-browser sign-in→save→load→delete test, and set `TURSO_*` / `AUTH_GITHUB_*` / `AUTH_SECRET` in Render (GitHub OAuth callback `…/api/auth/callback/github`). *(`conversations.ts` keeps the legacy `anonId` field - it now holds the GitHub user id.)*

## ✅ Audit reconciliation - 2026-06-20
Re-verified this handoff against the actual repo (git log/branch + file/test checks). Findings folded in below. Headline corrections:
- **Don't trust any pinned hash in this doc as the live HEAD - `git log` is the source of truth.** At audit time the session-#2 banner's "`master` (@ `8bb97ac`)" was already one docs commit stale, and HEAD has since advanced further through **docs-only** commits (this audit + the in-repo doc moves below + later reconcile passes; e.g. `3df9130`, `b15f455`, `107d833`, …). **No application code has changed since the audit - only docs.** All cited code hashes (`7d81169`, `8bb97ac`, `11774f2`, `0a31862`) remain real and accurate.
- **`live-mode` branch is fully merged into `master` and gone** (merge `11774f2`); only `master` + a long-merged local `ui-app-shell-retrofit` remain. The Live engine is **merged, not in flight** - any "in flight / unmerged" note (incl. in the root handoff) is stale.
- **Tests = 49 passing** (4 files: `devtrace`, `live`, `sentenceChunker`, `turnMachine`). The session-#1 "State" section below says "35/35" - that was true then; **49 is current**.
- **All named files exist** (verified): `src/hooks/{useLiveSession,useVoiceEngine,useVoiceAgent,useSpeechRecognition,useSpeech}.ts`, `src/app/api/{live-token,chat,usage}/route.ts`, `src/lib/{live,gemini,devtrace}.ts`, `src/components/{EngineToggle,DevPanel,ModelPicker}.tsx`, `docs/VOICE_AGENT_PLAN.md`.
- **Doc reorg:** the build plan now lives in this repo at `docs/VOICE_AGENT_PLAN.md` (moved out of the portfolio root); the pointer above is updated. The Echo QA checklist and the dev-panel design spec are now **in-repo too**: `docs/QA_TESTING.md` (Echo-scoped) and `docs/UNDER_THE_HOOD.md` (the spec Echo's `devtrace`/`live`/`DevPanel`/`EngineToggle` comments reference by section). The old portfolio-root copies (`../../QA_TESTING.md`, `../../UNDER_THE_HOOD_PLAN.md`) are gone - use the in-repo versions.
- **Still open / NOT done:** manual Chrome+mic QA of **both** Live mode and Classic voice (merged un-QA'd by the user's call). Deploy + live-demo URL: **✅ DONE 2026-06-20** - see the session-#3 note up top.

## ⚠️ Update - 2026-06-14 (session #2)
The sections below are from session #1 and are partly stale. Current truth:
- **SHIPPED PUBLIC** at `github.com/n8watkins/echo-genai-voice-agent`; `master` tracks `origin`, clean. (Audit 2026-06-20: the "@ `8bb97ac`" pinned here is stale - HEAD has moved on through docs-only commits; see the "Don't trust any pinned hash" note up top, and use `git log`.) Ignore older "not pushed / no remote / branch `ui-app-shell-retrofit`" notes in the session-#1 "State" section below - they are superseded: the app is public and `ui-app-shell-retrofit` is long merged.
- Local dir is now **`echo/`** (was `voice-agent/`).
- Added on master since: **favicon + OG cards**, a **Gemini model picker** (`MODELS` + server `pickModel` gate in `src/lib/gemini.ts`; shared key = `gemini-3.1-flash-lite` only, rest BYOK-only), an **"Under the hood" dev panel** (CPU-chip toggle → `src/components/DevPanel.tsx`, telemetry in `src/lib/devtrace.ts`), and README + lessons-blog sync.
- **✅ MERGED - native Gemini Live API voice engine** ("Live" vs "Classic" via a top-bar `EngineToggle`): ephemeral token (`src/app/api/live-token/route.ts`) → direct browser↔Gemini WebSocket → native PCM audio + server-side VAD/barge-in. Model `LIVE_MODEL` (`gemini-3.1-flash-live-preview`) in `src/lib/live.ts`. Engine in `src/hooks/useLiveSession.ts` (barge-in stops in-flight audio via `stopPlayback()` on `interrupted`); Classic path (`useVoiceAgent`) untouched + still the default. 49 tests green. **Merged before manual QA (user's call) - still needs a Chrome+mic QA pass; see `QA_TESTING.md` (Live-mode barge-in is the top item).**
  - **Verified free via a live probe (2026-06-14):** the Gemini Live API streams audio on the shared key - `gemini-3.1-flash-live-preview` returned audio with no billing error (ceiling = TPM, ~65K/min for flash-live; audio counts as tokens). Token minted demo-key-only for now.
  - **QA-tuning lever if barge-in/turn-taking feels off:** tune `realtimeInputConfig.automaticActivityDetection` sensitivity in `connect()`'s session config inside `useLiveSession.ts`. (Classic-mode levers are `BARGE_IN_COOLDOWN_MS` / `MIN_BARGE_IN_CHARS` in `useVoiceAgent.ts`.)

## What this is
Talk to an AI and it talks back - streamed, interruptible, with tools. The thesis (and blog): *the model was the easy part; the 800 milliseconds were the hard part.*

- **Stack:** Next.js 16 / React 19 / TS / Tailwind v4; `@google/genai` (`gemini-3.1-flash-lite`, configurable `ECHO_MODEL`).
- **Voice is browser-side:** Web Speech API `SpeechRecognition` (STT) + `speechSynthesis` (TTS). Server only streams the model's text over SSE (`src/app/api/chat/route.ts`).
- **Pipeline:** STT → SSE tokens → `SentenceChunker` (speak-as-you-stream) → TTS queue, driven by a pure turn-taking state machine (`src/lib/conversation/turnMachine.ts`).
- **Tools:** `get_current_time`, `get_weather` (Open-Meteo, keyless), `web_search` (**Tavily** LLM-search API via `TAVILY_API_KEY`, degrades gracefully).
- **Port 3200.** `npm run dev` / `npm run build` / `npm test` / `npm run lint`.

## Features
App-shell UI - **top bar** (persona switcher, **Conversation | Push** mode toggle, compact voice select, usage pill, settings gear, about), **left conversation rail**, **bottom mic/text dock**, **settings drawer**. Plus: 6 **personas** (prompt + matched voice + starter prompts), voice-quality upgrade (prefers neural/online voices), optional **Picovoice wake-word** ("Computer", env-gated via `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY`), BYOK + demo pool.

## State (session #1 snapshot - partly superseded; see the 2026-06-20 audit + session-#2 notes at top)
- ~~Branch **`ui-app-shell-retrofit`**, commits **`d321cfb`** (P0) + **`cc4429e`** (P1)~~. **Audit 2026-06-20:** stale - that branch is fully merged into `master` (HEAD `bb979a5`); the app is shipped public with a remote. `d321cfb`/`cc4429e` are still in history.
- `tsc --noEmit` ✅ · `eslint .` ✅ · `npm run build` ✅ · `npm test` ✅ ~~**35/35**~~ → **49/49** (current, audit 2026-06-20).
- **Hands-free + barge-in is the DEFAULT** (decided by the user). Self-interrupt is mitigated for real: the recognizer is **paused while Echo speaks**, with a **600ms post-TTS cooldown** and a **min interim length** before a barge-in counts - `src/hooks/useVoiceAgent.ts` + `pause()`/`resume()` in `src/hooks/useSpeechRecognition.ts`. Push-to-talk is the alternative mode.
- Demo pool **250 model-calls/day** (counted per `generateContentStream` call incl. tool rounds, BYOK bypasses) - `src/app/api/usage/route.ts`. Server-side input caps in `src/app/api/chat/route.ts` (message ≤4000, history clamped).
- Lint is real now (flat `eslint.config.mjs`; `next lint` was removed in Next 16). Vitest covers `transition()` + `SentenceChunker`. Dead code removed; `MicButton` has a real `size` prop; focus traps on `SettingsDrawer` + mobile `ChatRail`; Porcupine `.pv` is gitignored (download step in README + `.env.example`).

## Gotchas (hard-won)
- **Web Speech API is Chrome/Edge-only**, effectively unsupported on iOS Safari → the **text input is first-class**, not a courtesy. A reviewer on Firefox/iPhone still gets a working typed demo.
- **The mic hears Echo's own TTS** (physics, no raw stream from the Web Speech API to apply echo cancellation) → **headphones recommended**; the chosen fix is pausing the recognizer during speech, so *true mid-sentence* voice barge-in is limited (interruption works as the queue drains, via tap-to-stop, or in push-to-talk). This is stated honestly in all docs.
- **Gemini 3 thoughtSignature** must be preserved on tool round-trips (collect `modelParts` verbatim) - see `src/app/api/chat/route.ts`.
- 250 cap is **per-process/in-memory** (resets on cold start); Upstash is the durable upgrade.
- Tunables live at the top of `useVoiceAgent.ts`: `BARGE_IN_COOLDOWN_MS`, `MIN_BARGE_IN_CHARS`.
- **Render: two services exist - ALWAYS target `srv-d8rj3oegvqtc73f4hq1g`** (`echo-genai-voice-agent` / `echo-kzw1.onrender.com`, the live app + README URL). `echo` / `srv-d8rmci6gvqtc73f86ob0` / `echo-2egv.onrender.com` is a **stray duplicate - delete it.** A name-substring match on `"echo"` grabs the wrong one (this cost a long debugging detour). Render API key was in the session chat.
- **Auth.js needs `AUTH_URL` on Render.** `trustHost: true` alone inferred `localhost:10000` → wrong OAuth `callbackUrl` → sign-in would `redirect_uri`-mismatch. Fixed with `AUTH_URL=https://echo-kzw1.onrender.com` (now stubbed in `render.yaml` + documented in `.env.example`; leave blank for local dev).
- **Do NOT run `npm audit fix --force`.** The 7 audit warnings are all dev/build tooling (`vitest`/`vite`/`vite-node` + `postcss` via Next) - they don't ship at runtime, and the only offered fix downgrades **Next 16 → Next 9** (breaks everything). Verified the non-force `npm audit fix` is a no-op. Leave them; revisit only via a deliberate `vitest` v2→v3 major bump if desired.
- **Live mode needs the `v1alpha` API surface.** `ai.authTokens.create` + `ai.live.*` exist only on v1alpha; a default (v1beta) client returns a bare `{"error":{"message":"","code":404,"status":"Not Found"}}` from the token mint. `getClient(apiKey, 'v1alpha')` in `/api/live-token`; the browser `ai.live.connect` already passed `apiVersion: 'v1alpha'`. (Fixed session #3 - was the reason Live-mode "Start conversation" 404'd.)

## Next steps (ordered)
1. ~~Confirm the live deploy of auth + persistence came up green.~~ **✅ DONE & VERIFIED** - `/api/auth/providers` returns `github` with callback `https://echo-kzw1.onrender.com/api/auth/callback/github`; `/api/conversations` → `persistence:true`; `/api/healthz` → `hasDemoKey:true`. All env vars (incl. `AUTH_URL`) are set on the **correct** service **`srv-d8rj3oegvqtc73f4hq1g`** (`echo-genai-voice-agent`); the duplicate `srv-d8rmci6gvqtc73f86ob0` was deleted. **Only the human in-browser sign-in → save → reload → load/delete click-through remains unverified** (can't be driven headlessly).
2. **(FOCUS) Manual in-browser QA - nothing voice/auth/persistence has been human-tested.** Use **`docs/QA_TESTING.md`**.
   - **Persistence/auth (new):** sign in (GitHub, top-right) → talk/type → chat auto-saves → appears in the left rail → reload → still there → click a saved chat to load (read-only "viewing"), trash to delete; signed-out = no save, app still works. **If signed-in chats don't save, `session.user.id` isn't populating - check the `session` callback in `src/auth.ts`.**
   - **Live mode (new tools + transcript):** ask the weather / a web search → tool call fires, answer **spoken AND logged**; confirm your **own speech** shows in the transcript (input transcription only verifiable with a real mic); text input interrupts; starters connect+send.
   - **Live barge-in + Classic (original owed pass):** talk over Echo → audio cuts (`interrupted`→`stopPlayback()`); if turn-taking is off, tune `automaticActivityDetection` in `useLiveSession.ts`. Classic: mic capture, persona voice match, hands-free not self-interrupting (`BARGE_IN_COOLDOWN_MS`/`MIN_BARGE_IN_CHARS`), wake-word, model-picker BYOK, dev panel.
3. ~~Cosmetic - social-share cards on the live URL.~~ **✅ DONE** - `metadataBase` wired to `NEXT_PUBLIC_APP_URL` with a live-URL default (`src/app/layout.tsx:11`). Optional: set `NEXT_PUBLIC_APP_URL` in Render to override (not required - it already defaults to the live URL).
4. **Feature queue (deferred, in priority order):** HD voice via Gemini TTS (`generateContent`, BYOK-gated) → shareable session recordings → model picker incl. Claude (needs an Anthropic key/cost) → MCP server on Vercel exposing Echo's tools. *Portfolio decisions (don't re-litigate): HD TTS = **no** (browser TTS is the honest free default); MCP = **deprioritized**; embeddings = **Scout only, Echo skip**.*
5. **Optional infra:** Live mic capture `ScriptProcessorNode` → `AudioWorklet`; UptimeRobot keep-warm on `/api/healthz` @ 5 min (*user setting up*); `n8builds.dev` subpath migration; Upstash KV for a durable demo cap.

## File map
- `src/hooks/useVoiceAgent.ts` - orchestrator: STT → SSE → chunker → TTS, turn machine, barge-in/mitigation. **Tunables at top.**
- `src/hooks/useSpeechRecognition.ts` (STT + `pause/resume`) · `src/hooks/useSpeech.ts` (TTS queue + voice quality scoring).
- `src/lib/conversation/{turnMachine,sentenceChunker,tools,prompts}.ts` - state machine, speak-as-you-stream, tools, prompts.
- `src/lib/personas.ts` + `src/hooks/usePersona.ts` - the 6 personas.
- `src/app/api/chat/route.ts` - SSE + function-calling loop + input caps. `src/app/api/usage/route.ts` - 250/day cap.
- `src/app/page.tsx` - app-shell composition + engine switch (Classic preserved in the `engine==='classic'` branch).
- `src/components/{PersonaSwitcher,ModeToggle,VoiceQuickSelect,ChatRail,SettingsDrawer,HeadsetTip,VoiceOrb,MicButton,WakeWordToggle}.tsx` - UI.
- **Live mode (Mode B):** `src/hooks/useLiveSession.ts` (Live engine: token → `ai.live.connect()` → PCM in/out + barge-in + `toolCall` → `/api/tool-exec` → `sendToolResponse`) · `src/hooks/useVoiceEngine.ts` + `src/components/EngineToggle.tsx` (`classic|live` selector) · `src/app/api/live-token/route.ts` (mints ephemeral token, demo-key-only; tools locked in its config) · `src/app/api/tool-exec/route.ts` (runs the shared `dispatchTool` for Live tool calls) · `src/lib/live.ts` (`LIVE_MODEL` + PCM conversion helpers; `live.test.ts`).
- **Model picker:** `src/lib/gemini.ts` (`MODELS` allowlist + server `pickModel(requested, byok)`; `SHARED_MODEL = gemini-3.1-flash-lite` only on the shared key, rest BYOK-only) · `src/components/ModelPicker.tsx`.
- **Dev panel ("Under the hood"):** `src/lib/devtrace.ts` (shared `TraceEvent` telemetry; `devtrace.test.ts`) · `src/components/DevPanel.tsx` (CPU-chip toggle in the top bar; Live should emit the same `TraceEvent`s).
- `docs/blog/the-800ms-problem.md` (build log) · `docs/blog/lessons-and-the-near-future-of-voice.md` (reflection) · `docs/VOICE_AGENT_PLAN.md` (build plan).
- `*.test.ts` (Vitest, 49 tests: `devtrace`, `live`, `sentenceChunker`, `turnMachine`) · `eslint.config.mjs`.
- `render.yaml` - Render Blueprint (repo root): free web service, `npx next start -p $PORT`, `/api/healthz` health check, Node 22. **Live:** <https://echo-kzw1.onrender.com>.
- **Auth + persistence (session #3):** `src/auth.ts` (Auth.js v5 GitHub; empty providers when `AUTH_GITHUB_*` unset; `session.user.id` callback) · `src/app/api/auth/[...nextauth]/route.ts` · `src/components/{AuthButton,Providers}.tsx` · `src/types/next-auth.d.ts` · `src/lib/db.ts` (Turso client, off when `TURSO_*` unset) · `src/lib/conversations.ts` (data layer; the `anonId` field now holds the GitHub user id) · `src/app/api/conversations/{route,[id]/route}.ts` (session-scoped) · `src/hooks/useConversations.ts`.
