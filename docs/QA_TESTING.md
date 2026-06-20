# Echo — manual QA checklist

> Follow-up manual QA for things that **can't be verified headlessly** (build /
> test / lint already pass). Check items off as you go; note anything broken under
> "Findings". Run with `npm run dev` (http://localhost:3200). Use **Chrome** +
> **headphones** + a mic for voice.
>
> Echo-scoped extract of the original Scout+Echo checklist; Scout's items live in
> Scout's repo. State (2026-06-20 audit): every feature below is merged on
> `master` and pushed — but **both Live mode and Classic voice were merged
> un-QA'd (the user's call), so this checklist is still owed.** Live-mode barge-in
> is the top item.

## Live API "native voice" mode (highest priority) ⏳ not yet QA'd
- [ ] Top-bar **engine toggle** → switch to **Live**.
- [ ] Center stage shows a prominent **"Start conversation"** button (not just "tap the orb").
- [ ] Click Start → browser prompts for **mic permission** → grant.
- [ ] Talk → Echo replies in **Gemini's native voice** (clearly different/better than the Classic browser TTS).
- [ ] **Multi-turn:** after it answers, just talk again — no need to re-press anything.
- [ ] **Barge-in (the key fix):** while Echo is *speaking*, start talking → its audio should **cut off immediately** and it should listen to you.
- [ ] Bottom dock shows a live **token counter**; **Disconnect** stops cleanly.
- [ ] Switch back to **Classic** → the old pipeline still works.
- [ ] Open **🔌 "Under the hood"** → Live-mode telemetry populates (turn-total latency, tokens, no $).
- _If barge-in/turn-taking feels off, next lever: tune the Live API `realtimeInputConfig.automaticActivityDetection` sensitivity in `connect()`'s session config inside `src/hooks/useLiveSession.ts`._

## Classic voice pipeline ⏳ still pending QA
- [ ] Mic capture + live transcription works (Chrome).
- [ ] Persona switcher changes both personality **and** the matched voice.
- [ ] Hands-free mode doesn't self-interrupt (headphones); barge-in feels right — tune `BARGE_IN_COOLDOWN_MS` / `MIN_BARGE_IN_CHARS` at the top of `src/hooks/useVoiceAgent.ts` if not.
- [ ] Conversation ↔ Push mode toggle works mid-conversation; headset banner persists.
- [ ] Text input works as a no-mic fallback.
- [ ] Wake word ("Computer") starts a turn hands-free (needs `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY` + the `.pv` model — see README).

## Model picker
- [ ] On the **shared key** (no BYOK): only **Gemini 3.1 Flash Lite** is selectable; the others show "needs your own key" and are disabled.
- [ ] Paste your **own Gemini key** (settings/BYOK) → the other models (2.5 Flash, 2.5 Flash Lite, 3 Flash, 3.5 Flash) **unlock**.
- [ ] Pick a different model with BYOK → responses noticeably differ (verify via the dev panel showing the chosen **model id** per call).
- [ ] (Sanity) the server falls back to flash-lite if a non-shared model is requested without a key — can't trick the shared key into the expensive models (`pickModel` in `src/lib/gemini.ts`).

## "Under the hood" dev panel
- [ ] 🔌 CPU-chip toggle (top bar) → do a turn → panel shows the **latency waterfall** (STT → first-token → TTS → turn-total), token/cost, tool calls, turn-state timeline.
- [ ] Raw prompt/response accordions expand/collapse.
- [ ] Toggling off restores the normal product view; preference persists across reload.

## Share / SEO polish
- [ ] Browser tab shows the **favicon** (Echo cyan "E").
- [ ] Pasting the (eventual) deploy URL into Slack/iMessage shows the **OG preview card**. (Verify post-deploy; locally check `/opengraph-image` renders.)

## Findings (fill in during QA)
- …
</content>
