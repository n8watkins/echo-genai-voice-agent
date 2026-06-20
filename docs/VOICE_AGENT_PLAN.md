# Echo — Realtime Voice Agent · One-Shot Build Plan

> **Display name:** Echo
> **Folder:** `echo/`
> **Dev port:** `3200` (runs alongside net-trailers:3000, gemini-chat-app:5000, scout:3100)
> **Accent identity:** cyan → teal (`from-cyan-500 to-teal-500`), with a warm **rose-500** "live mic" accent. Palette map: net-trailers = orange/red, gemini = blue/indigo, Scout = violet/fuchsia, Echo = cyan/teal.

---

## 1. The pitch (one sentence)

Talk to an AI and it talks back — **in real time, interruptible, with tools** — so a spoken question like "what's the weather and what time is it in Tokyo?" gets answered out loud while you can cut it off mid-sentence and change the subject.

## 2. The thesis the project exists to prove (this is the blog post)

**"The model wasn't the hard part. The 800 milliseconds were."**

A voice agent lives or dies on *perceived latency* and *turn-taking*, not on the LLM. The differentiator vs. the rest of the portfolio: net-trailers used Web Speech API for one-shot voice *search*; gemini-chat-app streamed text over WebSockets. Neither closes the **full spoken loop** (mic → transcribe → think → speak) or deals with **barge-in** (interrupting the AI). Echo's personality is the conversation feeling *alive* instead of walkie-talkie.

Blog beats to design the build around (see §10):
- The pipeline and where the milliseconds hide: STT → LLM → TTS.
- **Speak as you stream:** chunk the LLM token stream into sentences and start TTS on sentence 1 instead of waiting for the full reply. This is the single biggest perceived-latency win.
- **Barge-in:** detect the user talking over the AI, cancel `speechSynthesis`, and yield the turn. Turn-taking is a state machine, not an afterthought.
- Why browser **Web Speech API** for STT+TTS (free, zero-key, frictionless demo) — and its honest limits (Chrome-only quirks, accent handling, no server control).

## 3. Stack (match the house stack)

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind v4** (same `globals.css` pattern as gemini-chat-app).
- **STT:** browser **Web Speech API** `SpeechRecognition` (interim + final results) — same API net-trailers already used for voice search, so it's a proven, free, no-key choice. Abstract it behind `useSpeechRecognition` so a cloud STT can drop in later.
- **LLM:** **@google/generative-ai**, `gemini-3.1-flash-lite`, **streaming** responses + **function calling**.
- **TTS:** browser **Web Speech API** `speechSynthesis` (free, no key), with a voice picker. Abstracted behind `useSpeech` so cloud TTS (e.g. higher-quality neural voices) is a later upgrade — mention this in the blog as the obvious next step.
- **Transport:** **SSE** for the LLM token stream (server → client). STT and TTS run *in the browser*, so the only server round-trip is the model; SSE keeps it simple and is an honest contrast to gemini's WebSockets (blog can note "I reached for WebSockets last time; this time the data only flows one way").
- **Heroicons** + **lucide-react** (match house icons).
- **better-sqlite3** (optional) to persist conversation transcripts, mirroring gemini's persistence; fine to run ephemeral on free tier.
- Deploy: **Render** free tier (reuse gemini's README war-story section).

## 4. BYOK + demo-key pattern (copy gemini-chat-app)

Same as the rest of the portfolio: instant use on a **shared demo key** with a **usage meter**, plus a **"bring your own Gemini key"** expander for unlimited use. STT/TTS need no keys (browser-native), which makes the zero-setup demo even smoother — call that out.

## 5. Directory layout

```
echo/
  src/
    app/
      layout.tsx
      page.tsx                       # the voice "stage"
      globals.css                    # Tailwind v4 + cyan/teal tokens + dark mode
      api/
        chat/route.ts                # POST transcript -> SSE token stream (+ tool calls)
        conversations/route.ts       # list/save transcripts (SQLite, optional)
        usage/route.ts               # demo-pool meter (port from gemini)
        healthz/route.ts
    components/
      OnboardingWizard.tsx           # REQUIRED intro modal + mic-permission step (§8)
      AboutContent.tsx               # shared "what is this" content (REQUIRED, §8)
      AboutModal.tsx
      VoiceOrb.tsx                   # central animated orb/waveform (idle/listen/think/speak)
      LiveCaptions.tsx               # big interim+final transcript captions
      ConversationLog.tsx            # scrollback of turns (user + AI)
      MicButton.tsx                  # push-to-talk / toggle, rose "live" state
      VoicePicker.tsx                # choose a speechSynthesis voice + rate/pitch
      StatusPill.tsx                 # "Listening… / Thinking… / Speaking…"
      InlineKeyEntry.tsx             # BYOK (port from gemini)
      UsageMeter.tsx                 # demo-pool meter (port from gemini)
      Modal.tsx                      # base modal shell (port from gemini)
    lib/
      conversation/
        turnMachine.ts               # idle->listening->thinking->speaking state machine (§6)
        sentenceChunker.ts           # split streaming tokens into speakable sentences (§7)
        tools.ts                     # weather / time / web_search function decls + dispatch
        prompts.ts                   # spoken-style system prompt (short, no markdown)
      gemini.ts                      # model client + BYOK/demo key resolution
      sse.ts                         # SSE encode/decode
      db.ts                          # better-sqlite3 (optional transcripts)
    hooks/
      useSpeechRecognition.ts        # Web Speech API STT wrapper (interim/final, restart)
      useSpeech.ts                   # speechSynthesis TTS wrapper (queue, cancel, voices)
      useVoiceAgent.ts               # orchestrates STT -> SSE -> chunker -> TTS + barge-in
      useApiKey.ts                   # BYOK (port from gemini)
      useUsageInfo.ts                # usage meter (port from gemini)
      useOnboarding.ts               # first-run flag (port from gemini)
  public/images/portrait-medium.jpg  # reuse the same portrait asset
  docs/blog/the-800ms-problem.md
  .env.example
  README.md
```

## 6. Turn-taking state machine (`lib/conversation/turnMachine.ts`)

The heart of "feels alive." Explicit states, not booleans scattered around:

```
idle ──(mic on / wake)──▶ listening
listening ──(final transcript)──▶ thinking
thinking ──(first sentence ready)──▶ speaking
speaking ──(speech ends)──▶ listening        // continuous conversation
speaking ──(user starts talking = BARGE-IN)──▶ listening   // cancel TTS immediately
any ──(mic off)──▶ idle
```

`useVoiceAgent.ts` drives it:
1. **listening:** `useSpeechRecognition` emits interim text → render live captions. On final result, transition to thinking.
2. **thinking:** POST the transcript (+ short history) to `/api/chat`; consume the **SSE token stream**.
3. **speaking:** feed tokens to `sentenceChunker`; as each sentence completes, enqueue it to `useSpeech` so audio starts on sentence 1 (don't wait for the full reply).
4. **barge-in:** while speaking, keep a lightweight recognizer (or volume threshold) listening; if the user speaks, **immediately `speechSynthesis.cancel()`**, drop the rest of the queued sentences, and jump back to listening with the new input.

## 7. Speak-as-you-stream (`sentenceChunker.ts`)

The perceived-latency win. Buffer incoming tokens; flush a chunk to TTS when you hit sentence-ending punctuation (`.`/`!`/`?`/newline) or a max length. Strip markdown/emoji (TTS reads them literally). Result: the AI starts talking ~1 sentence after the model starts, instead of after the whole response — turning a 3-second wait into ~800ms.

## 8. The intro modal — REQUIRED, must match house style

Same requirement as every portfolio app: a first-run wizard that **explains the project** and looks like the others (gemini's `OnboardingWizard.tsx`/`AboutContent.tsx`, net-trailers' `TutorialModal.tsx` are the templates). Echo's wizard has an **extra third step for microphone permission**, which is a natural fit.

**`OnboardingWizard.tsx`** — three steps (`About` → `How to talk to it` → `Enable mic`):
- Backdrop + panel identical structure to gemini's (`rounded-2xl max-w-5xl backdrop-blur-md z-[50000]`), shadow recolored **cyan** (`shadow-cyan-500/20`). Step pills + skip `XMarkIcon` exactly like gemini.
- **Step 1 (About):** a cyan thesis callout with a `SparklesIcon` / mic icon — *"Echo listens, thinks, and talks back in real time — and you can interrupt it mid-sentence, like a real conversation. Closing that spoken loop is the heart of this project."* — then `<AboutContent />`.
- **Step 2 (How to talk to it):** a 3-node pipeline mini-diagram (🎙️ You speak → 🧠 Gemini thinks → 🔊 Echo speaks) + tips: "tap the orb to start, talk over it to interrupt, try 'what's the weather in Paris and the time in Tokyo?'"
- **Step 3 (Enable mic):** demo-pool `UsageMeter`, collapsible BYOK `InlineKeyEntry`, and a **"Enable microphone"** button that triggers the `getUserMedia`/SpeechRecognition permission prompt. Gracefully handle denial (fall back to a text input box so the demo still works).
- Footer: gradient cyan/teal Skip / Next / Back / **`Start talking →`** buttons.

**`AboutContent.tsx`** — mirror gemini's structure precisely:
- Centered `Welcome to Echo` title.
- Cyan gradient intro card with the **same portrait + bio + social links row** (GitHub / LinkedIn / X / Portfolio) as the other apps.
- **🌟 Key Features** icon-card grid:
  - `MicrophoneIcon` — **Real-time voice** ("speak naturally, hear a reply in ~1 second").
  - `ArrowUturnLeftIcon` / hand icon — **Interrupt anytime** ("talk over Echo and it stops and listens — true barge-in").
  - `BoltIcon` — **Speaks as it thinks** ("starts talking on the first sentence, not the last").
  - `WrenchScrewdriverIcon` — **Voice tools** ("ask for weather, time zones, or a quick web lookup mid-conversation").
  - `KeyIcon` — **Free to try, BYOK optional** (no key needed — STT/TTS run in your browser).
  - `CodeBracketIcon` — **Open source on GitHub**.
- **⚡ Under the hood** 3-col block (Latency / Turn-taking / Privacy) with `✓` bullets — e.g. "Sentence-level streaming TTS", "Barge-in cancel", "State-machine turn-taking", "Speech never leaves your browser for STT/TTS".
- **🛠️ Tech Stack** pill row in gemini's exact pill style: TypeScript · Next.js 16 · React 19 · Tailwind CSS · Gemini AI · Web Speech API · SSE.
- Reuse the **"Portfolio project showcasing:"** footer idiom.

Wire `useOnboarding.ts` (localStorage `echo_onboarding_complete`).

## 9. Main UI (`page.tsx`) — "the stage"

Dark, centered, theatrical (Echo leans dark like net-trailers, cyan glow):
- **Center:** `VoiceOrb` — an animated blob/waveform that visually reflects state: gentle pulse (idle), reactive ripples scaled to mic volume (listening), shimmer (thinking), mouth-like pulse synced to TTS (speaking). This is the emotional centerpiece; make it genuinely nice (CSS/Canvas).
- **Under the orb:** `StatusPill` ("Listening… / Thinking… / Speaking…") + `LiveCaptions` (big interim transcript, like accessibility captions).
- **Bottom:** `MicButton` (rose when live) + `VoicePicker` + text-fallback input (for denied mic / accessibility).
- **Side panel (collapsible):** `ConversationLog` scrollback, BYOK, About re-open, `UsageMeter`.
- **Accessibility:** captions + text input mean the demo works even with no mic — important for portfolio reviewers on locked-down machines.

## 10. Blog post (`docs/blog/the-800ms-problem.md`)

Match gemini-chat-app's voice (first-person, self-deprecating, a mermaid diagram, memes). Outline:
1. **Hook:** "I got Gemini talking out loud in an afternoon. Making it not feel like a 1970s answering machine took two weeks."
2. **The pipeline:** mermaid diagram STT → LLM → TTS, with the latency cost annotated on each hop.
3. **The fix that mattered most:** speak-as-you-stream — chunk tokens into sentences, start TTS on sentence 1. Before/after timing.
4. **Turn-taking is a state machine:** the walkie-talkie problem; the explicit state diagram; why booleans weren't enough.
5. **Barge-in:** letting a human interrupt — detecting it and canceling `speechSynthesis` cleanly.
6. **Why browser Web Speech API (and where it bites):** free and instant, but Chrome-flavored and quirky; the abstraction seam for swapping in cloud STT/TTS later.
7. **Why SSE this time, not WebSockets:** the data only flows one way — knowing when *not* to use the heavier tool I used last project.
8. **What it taught me about AI UX:** latency *is* the product; the uncanny line between "responsive" and "alive."

## 11. Env (`.env.example`)

```
GEMINI_API_KEY=            # server demo-key fallback (optional; BYOK preferred)
GOOGLE_SEARCH_API_KEY=     # optional, for the web_search tool (reuses gemini's var)
GOOGLE_SEARCH_ENGINE_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3200
PORT=3200
```
(STT/TTS need no keys — they run in the browser.)

## 12. Run config (concurrency-safe)

```json
{
  "dev": "next dev -p 3200",
  "build": "next build",
  "start": "next start -p 3200"
}
```

## 12a. Known risks & revisions (read before building)

These override anything above where they conflict.

- **Barge-in is the hard part — default to push-to-talk.** While `speechSynthesis` plays through the speakers, the mic hears the AI's own voice and `SpeechRecognition` transcribes *it*, causing false interrupts / echo loops. Web Speech API doesn't expose the raw mic stream, so you can't apply echo cancellation to it. Therefore: **push-to-talk (tap-to-talk) is the reliable default turn mode**; "hands-free + barge-in" is a clearly-labeled *best-effort* toggle. Don't let continuous-listen be the only path. (This limitation is a featured chapter in the blog, not a bug to hide.)
- **Web Speech API is Chrome/Edge-only; iOS Safari effectively unsupported** and gates audio behind a user gesture. So: **the text-input fallback is first-class**, feature-detect on load, and onboarding recommends Chrome up front. A reviewer on Firefox/iPhone must still get a working (typed) demo.
- **Default TTS voices are robotic.** Keep browser `speechSynthesis` for the free, no-key demo, but auto-select the best available local voice, and name **cloud TTS as the explicit upgrade path** (already in the blog). Don't oversell "feels alive" beyond what local voices deliver.
- **Mid-conversation tool calls pause the stream.** When the model calls a tool, the SSE token stream stops, the tool runs, then a second model call continues. The `sentenceChunker` + TTS queue must tolerate that gap without speaking a half sentence.
- **SDK:** use the current **`@google/genai`** SDK (cleaner streaming + function-calling) rather than the legacy `@google/generative-ai@0.24`; note the divergence in the README. Model default `gemini-3.1-flash-lite`, made configurable via `ECHO_MODEL`.
- **API key handling:** the Gemini key lives only in `.env.local` (gitignored) — never in committed files, fixtures, or logs.

## 13. One-shot build checklist (order of operations)

1. Scaffold Next.js 16 + TS + Tailwind v4; `globals.css` cyan/teal tokens + dark mode.
2. `hooks/useSpeechRecognition.ts` and `hooks/useSpeech.ts` — prove mic-in and voice-out in isolation first.
3. `lib/gemini.ts` (BYOK/demo key) + `lib/sse.ts` + `api/chat/route.ts` streaming with function calling.
4. `lib/conversation/{sentenceChunker,turnMachine,tools,prompts}.ts`.
5. `hooks/useVoiceAgent.ts` — wire STT → SSE → chunker → TTS; get a full spoken round-trip working.
6. Add **barge-in** (cancel TTS on user speech) and continuous listening.
7. `VoiceOrb` + `LiveCaptions` + `StatusPill` + `MicButton` + `VoicePicker` + text fallback.
8. **Onboarding wizard (3 steps incl. mic permission) + AboutContent + AboutModal** (port + reskin cyan). Wire `useOnboarding`.
9. BYOK + `UsageMeter` + `/api/usage`; optional SQLite transcripts + `ConversationLog`.
10. `README.md` (reuse gemini's Render section) + blog post. Polish orb animation, mobile, error/denied-mic states.

---

## Running all four portfolio apps at once

Ports are deconflicted by design:

| App | Port | Start |
|---|---|---|
| net-trailers | 3000 | `cd net-trailers && npm run dev` |
| gemini-chat-app | 5000 | `cd gemini-chat-app && npm run dev` |
| scout (Scout) | 3100 | `cd scout && npm run dev` |
| echo (Echo) | 3200 | `cd echo && npm run dev` |

Optional convenience from `examples/` (uses `npx concurrently`, already a dep in gemini-chat-app):
```bash
npx concurrently -n trailers,gemini,scout,echo -c red,blue,magenta,cyan \
  "cd net-trailers && npm run dev" \
  "cd gemini-chat-app && npm run dev" \
  "cd scout && npm run dev" \
  "cd echo && npm run dev"
```
Each project keeps its own git repo, `.env.local`, and `node_modules` — they're fully independent apps that only share a port convention and a visual language.
