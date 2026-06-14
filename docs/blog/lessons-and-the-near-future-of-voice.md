# The model was the easy part — lessons from Echo, and the near future of talking to machines

*A reflection on building **Echo**, a realtime voice agent. The latency war-story lives in [the-800ms-problem](./the-800ms-problem.md); this is the wider take: what the build taught me, why the tech choices went the way they did, and where conversational voice is actually heading.*

## The challenge that made it worth building

Getting an AI to *speak* is an afternoon: pipe text into the browser's `speechSynthesis` and you have a talking computer. Getting it to feel like a *conversation* — fast, interruptible, not a walkie-talkie where you wait for the beep — is where the real work is. The curiosity: the model is basically a solved input here. So what's left? It turns out almost everything that makes voice feel human is *not the model.*

## Lesson 1: latency is the product

The pipeline is STT → LLM → TTS, and a human ear starts to feel a conversation is "broken" somewhere around a second of silence. You don't fix that with a faster model — you fix it by **never waiting for the whole answer.** Echo chunks the model's token stream into sentences and starts speaking sentence one while sentence two is still generating. A three-second reply becomes an ~800ms time-to-first-word. The model didn't get faster; the *perceived* latency collapsed because output started streaming out loud immediately.

That reframed latency for me as a **product surface**, not a benchmark. The trick is structural — overlap the stages — not "buy more GPU."

## Lesson 2: turn-taking is a state machine, not a pile of booleans

Idle → listening → thinking → speaking → back to listening, plus the interrupt path. I started with scattered boolean flags (`isListening`, `isSpeaking`…) and it became unmanageable the moment I added barge-in. Modeling it as one explicit state machine made the hard cases — interrupt mid-sentence, tool call pausing the stream, mode switching mid-conversation — tractable. "Can the user interrupt right now?" should be answerable by *what state we're in*, not by reading five flags.

## Lesson 3: the microphone hears the AI talk — and physics wins

This is the lesson I didn't see coming. While the AI is speaking through the laptop speakers, the **microphone picks up the AI's own voice**, the recognizer transcribes it, and the agent interrupts *itself* in an echo loop. The browser's Web Speech API doesn't hand you the raw audio stream, so you can't bolt on real acoustic echo cancellation. There is no clean software fix in the browser.

So the honest answers are non-software: **wear headphones** (the speaker output never reaches the mic), and offer **push-to-talk** as a reliable fallback for people on a laptop. I default to hands-free with barge-in because it feels best with headphones, and I tell the user that, plainly, instead of pretending the echo problem doesn't exist. The lesson generalizes: in voice UX, the hardware and the room shape the experience more than the model does, and the trustworthy move is to *name* the constraint rather than paper over it.

## Lesson 4: tech choices under a free-tier constraint

- **Browser Web Speech API for STT/TTS.** Free, zero-key, instant — perfect for a no-signup demo. The cost is honesty about the ceiling: it's Chrome/Edge-only, effectively unsupported on iOS Safari, and the default voices are robotic. I documented all of that rather than hiding it.
- **SSE, not WebSockets, again.** Because STT and TTS run *in the browser*, the only server round-trip is the model's text. That's one-directional, so SSE fits. (My last project reached for WebSockets; this one deliberately didn't. Same skill as before: match the transport to the data flow.)
- **The escalation path is real, not hand-wavy.** Better voice = Gemini's one-shot TTS (text→audio, far lighter than the streaming Live API) or a dedicated provider (Cartesia for speed, ElevenLabs for naturalness). The native realtime route — Gemini Live, where the model hears and speaks directly — is the "phone call" feel, but it's quota-heavy enough that it belongs behind bring-your-own-key, not on a shared free tier. Knowing *which* upgrade fits *which* constraint was half the design.
- **On-device wake word via Picovoice Porcupine.** Listening for a trigger word runs locally in the browser (WASM) — low power, and the audio never leaves the device. The right tool versus streaming everything to a cloud recognizer just to catch one word.

## Lesson 5: a voice agent is boring without a character

The blunt UX realization: a generic assistant with a mic is *dull*. The cheapest, highest-impact change was **personas** — a system prompt plus a matched voice plus a few starter prompts turns "a chatbot you talk to" into "pick a character and talk to it." Almost no code, enormous difference in whether you'd actually show it to someone. Personality is a feature, and it's mostly a prompt.

## Lesson 6: voice is an enhancement over a working text core

Because Web Speech is Chrome-only, the text input had to be **first-class**, not a courtesy — a reviewer on Firefox or an iPhone still gets a working app, just typed. That inverted my mental model: the conversation core is text; voice is a layer on top that degrades gracefully when the browser can't support it. Build the thing that always works, then enhance.

## Where this sits in AI right now

Realtime conversational voice is the current frontier — OpenAI's Realtime API, Gemini Live, ElevenLabs' agent stack — and the direction is **collapsing the pipeline**: native speech-to-speech models that skip the STT→text→TTS hops entirely, which kills latency and preserves tone, emotion, and interruption that a transcribe-then-resynthesize chain throws away. Echo is the pedagogical version of that: build the pipeline by hand so you understand exactly what the native models are compressing.

## What it likely means (the grounded version)

Voice is moving from **command** (Siri/Alexa: say the magic words, get one action) to **conversation** (interrupt, change your mind, be understood in context). As latency and turn-taking get solved — and they're getting solved fast — voice agents will feel genuinely human in *narrow* domains first: front-line phone support, scheduling, in-car and other hands-busy/eyes-busy settings.

The most underrated impact is **accessibility**: a conversational interface is a real unlock for people with vision impairments, limited literacy, or motor constraints — bigger, quietly, than the customer-support cost savings everyone leads with. The flip side worth keeping honest about: "feels human" and "always listening" are the same capability viewed from two angles, and the privacy and trust questions (what's recorded, when it's listening, whether you can tell you're talking to a machine) get sharper exactly as the experience gets smoother. The engineering that makes it pleasant is the same engineering that makes those questions urgent.

---

*For the grounded market analysis — speech-to-speech models, the latency budget, cloud
vs. on-device, and who's actually building it — see [The state of voice AI](./the-state-of-voice-ai.md).
The latency build-log is [The 800ms Problem](./the-800ms-problem.md).*
