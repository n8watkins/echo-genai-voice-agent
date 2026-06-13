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
- ↩️ **Barge-in** — talk over Echo and it cancels speech and listens (best-effort
  hands-free mode; see limitations).
- ⌨️ **First-class text fallback** — no mic, locked-down machine, or Firefox/iOS?
  The typed demo always works.

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
| `NEXT_PUBLIC_APP_URL`, `PORT` | App URL / port (3200). |

No key at all? The in-app **"bring your own free Gemini key"** panel stores a key
in your browser (localStorage) and never sends it anywhere but Echo's own API.

## BYOK + demo-key pattern

Like the rest of the portfolio: instant use on a shared demo key with a usage
meter, plus a BYOK expander for unlimited use. STT/TTS need no key at all, which
makes the zero-setup demo even smoother.

## Limitations (the honest part)

- **Barge-in is hard, so push-to-talk is the default.** While `speechSynthesis`
  plays through the speakers, the mic can hear Echo's own voice and transcribe it,
  causing false interrupts. The Web Speech API doesn't expose the raw mic stream,
  so you can't apply echo cancellation. Hands-free + barge-in is a clearly-labeled
  *best-effort* toggle, not the default.
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
