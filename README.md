# Echo — Realtime Voice Agent

> Talk to an AI and it talks back — **in real time, interruptible, with tools.**
> Ask "what's the weather in Paris and the time in Tokyo?" out loud and hear the
> answer while you can cut Echo off mid-sentence and change the subject.

Echo is a portfolio project about the part of voice AI that isn't the model: the
**~800 milliseconds** of perceived latency and the **turn-taking** that decide
whether a voice agent feels *alive* or like a 1970s answering machine. See the
write-up in [`docs/blog/the-800ms-problem.md`](docs/blog/the-800ms-problem.md).

Accent identity: **cyan → teal**, with a warm **rose** "live mic" accent.

---

## What it does

- 🎙️ **Real-time voice** — speak naturally, hear a reply in about a second.
- 🧠 **Streams + tools** — Gemini answers with streaming, and can call weather,
  time-zone, and web-search tools mid-conversation.
- 🔊 **Speaks as it thinks** — a sentence chunker starts text-to-speech on the
  *first* sentence instead of waiting for the whole reply (the big latency win).
- ↩️ **Hands-free + barge-in (default)** — Echo listens continuously and you can
  talk over it to cut it off. Headphones recommended; see limitations for the
  self-interrupt mitigation and the push-to-talk alternative.
- ⌨️ **First-class text fallback** — no mic, locked-down machine, or Firefox/iOS?
  The typed demo always works.
- 🎭 **Personas** — switch characters (Witty Mentor, Noir Detective, Hype Coach,
  Calm Guide, Storyteller, …). Each swaps the system prompt, auto-picks a
  matching browser voice, and shows its own starter prompts.
- 🗣️ **Wake word (optional)** — say "Computer" to start a turn hands-free, with
  on-device detection (Picovoice Porcupine). Off by default; opt-in via env key.

## How it works (the pipeline)

```
You speak ──▶ SpeechRecognition (browser STT) ──▶ POST /api/chat
                                                      │ SSE token stream
                                  Gemini ◀────────────┘ (+ function calling)
   speechSynthesis (browser TTS) ◀── sentence chunker ◀── tokens
```

- **STT & TTS run entirely in the browser** via the Web Speech API — free,
  no key, and the speech never leaves your machine. They're abstracted behind
  `useSpeechRecognition` / `useSpeech` so a cloud STT/TTS can drop in later.
- **The only server round-trip is the model.** That one-way token flow is why
  the transport is **SSE**, not WebSockets — an honest contrast to the
  WebSocket transport in my [gemini-chat-app](../gemini-chat-app).
- **Turn-taking is an explicit state machine** (`lib/conversation/turnMachine.ts`):
  `idle → listening → thinking → speaking`, with barge-in as a first-class edge.

## Personas

Pick a persona from the **persona switcher in the top bar** (`src/lib/personas.ts`).
Selecting one:

- **Changes the system prompt** sent to `/api/chat` — that's the *only* thing
  that changes server-side. No extra model calls, no new APIs; tools and
  function-calling are untouched. The route uses the provided prompt and falls
  back to the default in `lib/conversation/prompts.ts`.
- **Auto-picks a matching voice** from the browser's voices via each persona's
  `voiceHint` (gender / language / name). Your manual voice pick always wins and
  persists.
- **Swaps the starter-prompt chips** shown near the orb in the idle state.

The choice persists in `localStorage` (`echo_persona`). All persona prompts are
written spoken-style (short sentences, no markdown) since they feed TTS.

## Voice quality (free, no key)

Browser voices vary wildly. `useSpeech` scores the available
`speechSynthesis.getVoices()` with heuristics — names containing *Natural*,
*Neural*, *Google*, *Premium*, *Enhanced*, or online (`localService === false`)
voices rank highest — and surfaces a **Recommended** group in the picker
alongside **All voices**, plus rate/pitch controls. This is purely client-side
and costs nothing. Quality still depends on your OS: Chrome and recent
macOS/Windows ship the nicest neural voices.

## Wake word (optional, on-device)

Set `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY` and a **Wake word** toggle appears in the
panel. When enabled, [Picovoice Porcupine](https://picovoice.ai/) listens
**on-device** (WebAssembly, in the browser) for the built-in keyword
**"Computer"**; on detection it starts a listening turn. The Porcupine modules
are lazy-loaded only when the toggle is on and a key exists, so they never affect
the build or runtime otherwise.

Honest caveats (also shown in the UI):

- **Tab must stay open.** A web app has no OS-level background listening — wake
  detection only runs while the Echo tab is open.
- **Chrome/Edge + mic permission required**, same as the rest of voice mode.
- Uses a **built-in** keyword ("Computer") so no custom-trained `.ppn` is needed.
  You can train a custom "Hey Echo" in the Picovoice console and drop it in later.
- The default acoustic model is served from `public/models/porcupine_params.pv`.
  This ~1MB binary is **not committed** (it's gitignored). Fetch it on demand
  only if you enable the wake word:

  ```bash
  mkdir -p public/models
  curl -L -o public/models/porcupine_params.pv \
    https://raw.githubusercontent.com/Picovoice/porcupine/master/lib/common/porcupine_params.pv
  ```

  Without it, the rest of Echo works unchanged; the wake-word toggle simply
  fails to start and shows its error hint.

## Tech stack

TypeScript · Next.js 16 (App Router) · React 19 · Tailwind v4 · `@google/genai` ·
Web Speech API · Server-Sent Events.

> **SDK note:** Echo uses the current **`@google/genai`** SDK, not the legacy
> `@google/generative-ai@0.24` used by the older gemini-chat-app. The new SDK has
> cleaner streaming and function calling. One Gemini 3 wrinkle worth knowing: when
> you send a `functionCall` back for the tool-result round, you must preserve its
> `thoughtSignature` part verbatim or the API rejects it (400). Echo collects the
> model's parts straight from the stream to keep that intact.

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your key (or leave empty to use BYOK in-app)
npm run dev                  # http://localhost:3200
```

Open <http://localhost:3200> in **Chrome or Edge on desktop** for the full voice
experience. The first run shows a 3-step intro (About → How to talk to it →
Enable mic).

### Environment

| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server demo-key fallback (optional; BYOK preferred). |
| `ECHO_MODEL` | Model id. Defaults to `gemini-3.1-flash-lite`. |
| `GOOGLE_SEARCH_API_KEY` / `GOOGLE_SEARCH_ENGINE_ID` | Optional — enables the `web_search` tool. Without them, Echo answers from its own knowledge. |
| `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY` | Optional — enables the on-device wake-word toggle. Free key from [Picovoice Console](https://console.picovoice.ai/). Absent → toggle is disabled with a hint. |
| `NEXT_PUBLIC_APP_URL`, `PORT` | App URL / port (3200). |

No key at all? The in-app **"bring your own free Gemini key"** panel stores a key
in your browser (localStorage) and never sends it anywhere but Echo's own API.

## BYOK + demo-key pattern

Like the rest of the portfolio: instant use on a shared demo key with a usage
meter, plus a BYOK expander for unlimited use. STT/TTS need no key at all, which
makes the zero-setup demo even smoother.

The shared demo key is **hard-capped at 250 model calls per rolling 24h** (a
single chat turn can fire several calls when it uses tools, and every actual call
counts — even ones that error or abort). BYOK requests bypass the cap entirely.
**Note:** the counter is **in-memory / per-process**, so it resets on a Render
free-tier cold start — it's a best-effort soft guard, not a durable global
ceiling. A durable cross-process cap would store the rolling counter in an
external KV (e.g. Upstash Redis); intentionally not added here.

## Limitations (the honest part)

- **Hands-free + barge-in is the default — with a mitigation for the echo loop.**
  While `speechSynthesis` plays through the speakers, the mic can hear Echo's own
  voice and transcribe it, causing a false interrupt. The Web Speech API doesn't
  expose the raw mic stream, so you can't apply echo cancellation. Echo mitigates
  this by **pausing the recognizer while it speaks**, adding a short **post-TTS
  cooldown** before honoring barge-in again, and requiring a **minimum interim
  length** so a stray echo fragment can't count as an interrupt. **Headphones are
  recommended** for the cleanest experience. A genuine interruption — actually
  talking over Echo as the queue drains, or tapping the mic to stop — still works,
  and **push-to-talk is available as the alternative mode** (top-bar toggle).
- **Web Speech API is Chrome/Edge-only;** iOS Safari is effectively unsupported.
  That's why the typed input is first-class and onboarding recommends Chrome.
- **Local TTS voices are robotic.** Echo auto-selects the best available local
  voice; higher-quality neural **cloud TTS is the planned upgrade** (the seam is
  already there in `useSpeech`).

## Deploying (Render free tier)

This is the same war story as the other portfolio apps: Echo runs fine on a
single Render Web Service free instance.

- **Build command:** `npm install && npm run build`
- **Start command:** `npm run start` (binds to `PORT`, defaults to 3200)
- Set `GEMINI_API_KEY` in the Render dashboard env vars (never commit it).
- Free instances spin down when idle and cold-start in ~30s on the next request —
  fine for a portfolio demo. Transcripts are intentionally ephemeral.
- Because STT/TTS are browser-side, there's no audio infrastructure to provision;
  the server only proxies the model stream.

## Running alongside the other portfolio apps

Ports are deconflicted by design:

| App | Port |
|---|---|
| net-trailers | 3000 |
| gemini-chat-app | 5000 |
| agentic-researcher (Scout) | 3100 |
| **voice-agent (Echo)** | **3200** |

---

A portfolio project by Nathan Watkins ·
[GitHub](https://github.com/n8watkins) ·
[Portfolio](https://n8sportfolio.vercel.app/)
