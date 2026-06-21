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
- **The escalation path is real, not hand-wavy.** Better voice = Gemini's one-shot TTS (text→audio, far lighter than the streaming Live API) or a dedicated provider (Cartesia for speed, ElevenLabs for naturalness). The native realtime route — Gemini Live, where the model hears and speaks directly — is the "phone call" feel. I ended up *building* that route too (Lesson 7), kept Classic as the default, and put Live behind an explicit Connect click to protect the shared quota. Knowing *which* upgrade fits *which* constraint was half the design.
- **On-device wake word via Picovoice Porcupine.** Listening for a trigger word runs locally in the browser (WASM) — low power, and the audio never leaves the device. The right tool versus streaming everything to a cloud recognizer just to catch one word.

## Lesson 5: a voice agent is boring without a character

The blunt UX realization: a generic assistant with a mic is *dull*. The cheapest, highest-impact change was **personas** — a system prompt plus a matched voice plus a few starter prompts turns "a chatbot you talk to" into "pick a character and talk to it." Almost no code, enormous difference in whether you'd actually show it to someone. Personality is a feature, and it's mostly a prompt.

## Lesson 6: voice is an enhancement over a working text core

Because Web Speech is Chrome-only, the text input had to be **first-class**, not a courtesy — a reviewer on Firefox or an iPhone still gets a working app, just typed. That inverted my mental model: the conversation core is text; voice is a layer on top that degrades gracefully when the browser can't support it. Build the thing that always works, then enhance.

## Lesson 7: build the pipeline by hand, *then* reach for the managed primitive

After hand-rolling the whole STT→stream→chunk→TTS loop, I added a second voice engine: Gemini's native **Live API**. You pick it from a Classic | Live toggle, and it's a completely different shape. The browser mints an **ephemeral token** server-side (the raw key never ships), then connects *directly* to Gemini over a WebSocket (`gemini-3.1-flash-live-preview`); raw PCM audio streams up at 16 kHz and back down at 24 kHz, the model's own server-side VAD decides turn boundaries, and **barge-in is a signal the server sends you** — you just stop the audio you've queued. The thing I spent the whole project engineering — the 800ms perceived-latency win, the turn-taking, the interruption — the Live API does *for* you, as a primitive.

So why build the hand version at all? Because doing it by hand is how you understand what the managed API is actually compressing — and how you stay able to *judge* it. With Live side by side, the trade-offs got concrete instead of theoretical. The win is real: lower latency and a genuinely natural voice, because there's no transcribe-then-resynthesize round trip flattening the tone. But it isn't free in the way Classic is. Classic's STT and TTS happen in the browser and cost nothing; Live's audio is **billed as tokens** in both directions, so a feature that was free becomes metered the moment you flip the toggle. That's why Echo keeps Classic as the default, holds Live behind an explicit *Connect* click rather than opening a socket on load, and reports Live's usage in **tokens rather than dollars** — the audio-token rate isn't something I'd state with confidence yet.

The senior-engineering lesson is the sequence, not either choice on its own: build it by hand to learn the domain, then know when to stop hand-rolling and reach for the primitive that's now better than what you'd write. The point of building the loop yourself was never to ship the loop forever — it was to earn the judgment to evaluate the thing that replaces it.

One more thing the side-by-side taught me, and it's the most counterintuitive part: **the managed version isn't a magic "it just works" button.** Later, when I tried to give the native voice its own web search, Google has a built-in "just flip on search" option — literally one line of config. It connected… then instantly hung up on me with a blank, cryptic error. Took some digging to learn that feature needs a *paid* plan; on the free tier it just dies on the spot. So I wired search up the manual way instead — and *that* path was free. Sit with that for a second: the fancy managed feature was the expensive one, and the do-it-yourself version cost nothing. The takeaway isn't "managed bad" — it's that you genuinely don't know what a primitive costs, or how it behaves, until you poke it with your own key.

## Lesson 8: you can't tune a latency budget you can't see

"~800ms time-to-first-word" is a nice claim until someone asks *where* the milliseconds actually go. So I built an "under the hood" panel: a live **latency waterfall** that breaks a turn into its stages — STT, model first-token, each sentence's TTS, and the turn-total headline — alongside the token counts, tool calls, and the turn-state timeline. The 800ms budget, made literal, as bars you can read.

Two things fell out of it. First, it turned a slogan into an instrument: the same panel runs for both Classic and Live, so the side-by-side latency comparison is something you *watch*, not something I assert. Second — and this is the part I'd generalize — observability isn't a debugging afterthought for a latency product; it's part of the product surface. When perceived speed *is* the feature, being able to point at where a turn spent its time is how you defend, and keep, the number.

## Picking between APIs (the part no tutorial really covers)

Honestly, a lot of this project wasn't writing code — it was standing at a fork between two APIs that both technically "work" and figuring out which one actually fit. If you're newer to this, that's the skill nobody hands you a guide for, so here are the real forks I hit, in plain language:

- **Glue it together, or use the all-in-one?** For voice you can either bolt three separate services together — one to *hear* (speech-to-text), one to *think* (the language model), one to *speak* (text-to-speech) — or use a single "native" model that hears and speaks on its own. The glued version is cheap and you control every piece; the all-in-one feels more like a real phone call but charges you for the audio. Neither is "correct" — it's a tradeoff, so I built both just to feel the difference.
- **Let the model search, or build search myself?** Same shape. The model has a built-in web search you flip on (managed — but, as I found out the hard way, paid), or you hand it your *own* search tool and run it yourself (more wiring, but free). And "build it myself" had its own sub-fork: a general search API versus one made specifically for feeding AI clean results. I picked the AI-flavored one (Tavily) because it hands back tidy answers instead of a pile of links I'd have to untangle.
- **How does the browser talk to the AI without leaking my keys?** The native voice runs *in your browser*, so the browser needs credentials — but you never, ever want your real API key sitting in someone's browser tab. The fix is "ephemeral tokens": the server hands out a one-time, short-lived pass scoped to exactly what's allowed, and the browser uses that. Felt like overkill right up until I realized it's just… how you do this safely.

The product-brain version of all three: **an API choice is a product choice.** "Which is cheaper, faster, simpler, more private?" is the real question, and the answer flips from project to project. Just knowing these forks exist — and what each side trades away — is most of the battle.

## Building it with an AI riding shotgun

I'll say it plainly: I built a big chunk of this with an AI coding assistant, and it's worth being honest about, because it changed *what the hard part even was*. The AI was genuinely great at the "how" — cranking out boilerplate, standing up the database layer, and especially poking the voice API with little throwaway test scripts to learn how it *actually* behaved on my key. (That's literally how we caught the paid-search trap and a nasty "you're calling the wrong version of the API" bug *before* they turned into real problems.)

But the things it couldn't do for me are the things that mattered: deciding *which* API to reach for, what the app should feel like, when to cut a feature, which tradeoff I was actually willing to live with. Which is this whole project's thesis showing up again — **the model is the easy part.** The AI made me faster at the typing; I'm still the one on the hook for the "what" and the "why." If you're earlier in your journey, I'd lean all the way into that: let the AI handle the keystrokes, but *you* make the calls — because the calls are the actual job.

## Where I'd reach for this next

A few patterns from this I'm absolutely stealing for my own stuff:
- **Build the boring version first to understand it, then swap in the fancy one.** I won't pull in a managed "magic" service again without first knowing what it's hiding.
- **Probe before you commit.** Five minutes of "let me just test what this thing actually does" saves you hours of confusion later.
- **Treat speed as a feature** — and toss in a little personality. The personas were almost no code and made the whole thing feel *alive*.

And now that I've got a reusable "talk to it and it talks back" loop sitting in my toolbox, I keep imagining where I'd drop it next: a hands-free helper while I'm cooking, a little voice journal I can just talk at, a coding buddy I can ask things out loud without breaking my flow. The fun twist is that the hard 800 milliseconds are *solved* now — so the next version is mostly just deciding what it's for.

## Where this sits in AI right now

Realtime conversational voice is the current frontier — OpenAI's Realtime API, Gemini Live, ElevenLabs' agent stack — and the direction is **collapsing the pipeline**: native speech-to-speech models that skip the STT→text→TTS hops entirely, which kills latency and preserves tone, emotion, and interruption that a transcribe-then-resynthesize chain throws away. Echo is the pedagogical version of that — and then literally both halves of it: the hand-built pipeline next to a native Live engine you can toggle into, so the thing the native models compress is something you can watch them compress.

## What it likely means (the grounded version)

Voice is moving from **command** (Siri/Alexa: say the magic words, get one action) to **conversation** (interrupt, change your mind, be understood in context). As latency and turn-taking get solved — and they're getting solved fast — voice agents will feel genuinely human in *narrow* domains first: front-line phone support, scheduling, in-car and other hands-busy/eyes-busy settings.

The most underrated impact is **accessibility**: a conversational interface is a real unlock for people with vision impairments, limited literacy, or motor constraints — bigger, quietly, than the customer-support cost savings everyone leads with. The flip side worth keeping honest about: "feels human" and "always listening" are the same capability viewed from two angles, and the privacy and trust questions (what's recorded, when it's listening, whether you can tell you're talking to a machine) get sharper exactly as the experience gets smoother. The engineering that makes it pleasant is the same engineering that makes those questions urgent.

---

*For the grounded market analysis — speech-to-speech models, the latency budget, cloud
vs. on-device, and who's actually building it — see [The state of voice AI](./the-state-of-voice-ai.md).
The latency build-log is [The 800ms Problem](./the-800ms-problem.md).*
