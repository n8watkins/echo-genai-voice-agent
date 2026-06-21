'use client';

import { useEffect, useState } from 'react';
import {
  InformationCircleIcon,
  PaperAirplaneIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { useLiveSession } from '@/hooks/useLiveSession';
import { useVoiceEngine } from '@/hooks/useVoiceEngine';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useApiKey } from '@/hooks/useApiKey';
import { useUsageInfo } from '@/hooks/useUsageInfo';
import { usePersona } from '@/hooks/usePersona';
import { useWakeWord } from '@/hooks/useWakeWord';
import { useDevView } from '@/hooks/useDevView';
import DevPanel from '@/components/DevPanel';
import VoiceOrb from '@/components/VoiceOrb';
import StatusPill from '@/components/StatusPill';
import LiveCaptions from '@/components/LiveCaptions';
import MicButton from '@/components/MicButton';
import StarterPrompts from '@/components/StarterPrompts';
import OnboardingWizard from '@/components/OnboardingWizard';
import AboutModal from '@/components/AboutModal';
import PersonaSwitcher from '@/components/PersonaSwitcher';
import ModeToggle from '@/components/ModeToggle';
import EngineToggle from '@/components/EngineToggle';
import VoiceQuickSelect from '@/components/VoiceQuickSelect';
import { UsagePill } from '@/components/UsageMeter';
import SettingsDrawer from '@/components/SettingsDrawer';
import ChatRail from '@/components/ChatRail';
import { HeadsetTipBanner } from '@/components/HeadsetTip';

export default function StagePage() {
  const { persona, personaId, selectPersona, personas } = usePersona();
  const agent = useVoiceAgent({ systemPrompt: persona.systemPrompt });
  const { engine, setEngine } = useVoiceEngine();
  const live = useLiveSession({ systemPrompt: persona.systemPrompt });
  const { showWizard, completeOnboarding, reopenOnboarding } = useOnboarding();
  const { hasApiKey } = useApiKey();
  const usage = useUsageInfo();
  const wake = useWakeWord({ onWake: () => agent.startListening() });
  const devView = useDevView();

  const liveMode = engine === 'live';

  // Map the Live session status onto the orb's TurnState vocabulary
  // (connecting/error fall back to idle for the orb visual).
  const liveOrbState =
    live.status === 'listening' || live.status === 'thinking' || live.status === 'speaking'
      ? live.status
      : 'idle';

  // The trace + state the dev panel / orb read depend on the active engine, so
  // the side-by-side latency comparison works for whichever backend is live.
  const activeTrace = liveMode ? live.trace : agent.trace;

  const [railOpen, setRailOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [draft, setDraft] = useState('');

  // Auto-pick a voice matching the active persona's hint (unless the user has
  // manually overridden the voice — applyVoiceHint no-ops in that case).
  const { applyVoiceHint } = agent.speech;
  useEffect(() => {
    applyVoiceHint(persona.voiceHint);
  }, [persona.voiceHint, applyVoiceHint, agent.speech.voices.length]);

  // Switching engines must quiet the path we're leaving so the two backends
  // never run at once. Classic stays the default and is untouched in behavior.
  const switchEngine = (next: typeof engine) => {
    if (next === engine) return;
    if (next === 'live') {
      agent.stopAll(); // silence the hand-built pipeline
    } else {
      live.disconnect(); // close the Live socket + mic
    }
    setEngine(next);
  };

  const orbClick = () => {
    if (liveMode) {
      if (live.connected) live.disconnect();
      else void live.connect();
      return;
    }
    if (agent.state === 'idle') agent.startListening();
    else agent.stopAll();
  };

  const showStarters = agent.state === 'idle' && agent.log.length === 0 && !agent.partialReply;

  // The headset tip is relevant whenever hands-free mode is active.
  const headsetTipActive = agent.micSupported && agent.handsFree;

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    agent.submitText(text);
    setDraft('');
  };

  const newConversation = () => {
    agent.stopAll();
    agent.clearLog();
  };

  return (
    <main className="echo-stage h-dvh flex flex-col text-cyan-50 relative overflow-hidden">
      {/* ---- Top bar -------------------------------------------------------- */}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 z-10 border-b border-white/5">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setRailOpen((o) => !o)}
            aria-label="Toggle conversations panel"
            aria-pressed={railOpen}
            className="p-2 rounded-lg hover:bg-white/5 text-cyan-200/70 hover:text-cyan-100 transition"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
          </button>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
            Echo
          </span>
          <PersonaSwitcher personas={personas} activeId={personaId} onSelect={selectPersona} />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <EngineToggle engine={engine} onChange={switchEngine} />
          {agent.micSupported && !liveMode && (
            <ModeToggle handsFree={agent.handsFree} onChange={agent.setHandsFree} />
          )}
          <VoiceQuickSelect speech={agent.speech} />
          <UsagePill usage={usage} />
          <button
            onClick={devView.toggle}
            aria-label="Toggle under-the-hood dev view"
            aria-pressed={devView.enabled}
            title="Under the hood — show the live telemetry panel"
            className={`p-2 rounded-lg transition ${
              devView.enabled
                ? 'bg-cyan-500/15 text-cyan-200'
                : 'hover:bg-white/5 text-cyan-200/70 hover:text-cyan-100'
            }`}
          >
            <CpuChipIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 text-cyan-200/70 hover:text-cyan-100 transition"
            aria-label="Open settings"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setAboutOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 text-cyan-200/70 hover:text-cyan-100 transition"
            aria-label="About Echo"
          >
            <InformationCircleIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ---- Body: rail + center stage ------------------------------------ */}
      <div className="flex-1 flex min-h-0">
        <ChatRail
          open={railOpen}
          onClose={() => setRailOpen(false)}
          log={agent.log}
          partialReply={agent.partialReply}
          onNew={newConversation}
          onClear={agent.clearLog}
        />

        <section className="flex-1 flex flex-col min-w-0">
          {/* Center stage */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 sm:gap-6 px-4 py-4 sm:py-6 overflow-y-auto">
            {liveMode ? (
              <>
                <VoiceOrb state={liveOrbState} onClick={orbClick} />

                {live.status === 'connecting' ? (
                  <p className="text-sm font-medium text-cyan-100/90">Connecting to Gemini Live…</p>
                ) : live.connected ? (
                  <>
                    <p className="text-sm font-medium text-cyan-100/90">
                      {live.status === 'thinking'
                        ? 'Thinking…'
                        : live.status === 'speaking'
                          ? 'Speaking… — talk over Echo to cut in'
                          : 'Listening — just talk (talk over Echo to interrupt)'}
                    </p>
                    {live.transcript && (
                      <p className="max-w-md text-center text-sm text-cyan-200/70">
                        {live.transcript}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => void live.connect()}
                      className="rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-teal-400"
                    >
                      Start conversation
                    </button>
                    <p className="max-w-md text-center text-sm text-cyan-100/80">
                      Real-time voice using Gemini&rsquo;s native audio. Once you start, just talk
                      &mdash; it listens continuously and you can <strong>talk over it to
                      interrupt</strong>, like a phone call. Headphones recommended.
                    </p>
                  </>
                )}

                <p className="max-w-md text-center text-xs text-cyan-200/40">
                  Realtime PCM audio streamed directly to Gemini over WebSocket.
                  Connecting opens a live socket (uses the shared TPM budget).
                </p>

                {live.error && (
                  <p className="text-sm text-rose-400 max-w-md text-center bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-2">
                    {live.error}
                  </p>
                )}
              </>
            ) : (
              <>
                <VoiceOrb state={agent.state} onClick={orbClick} />

                <StatusPill state={agent.state} tool={agent.activeTool} />

                <LiveCaptions interim={agent.interim} reply={agent.partialReply} />

                {agent.error && (
                  <p className="text-sm text-rose-400 max-w-md text-center bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-2">
                    {agent.error}
                  </p>
                )}

                {showStarters && (
                  <StarterPrompts prompts={persona.starterPrompts} onPick={agent.submitText} />
                )}
              </>
            )}
          </div>

          {/* ---- Bottom dock --------------------------------------------- */}
          {liveMode ? (
            <div className="flex-shrink-0 border-t border-white/10 bg-white/[0.03] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
                <span className="text-xs text-cyan-200/60">
                  {live.connected
                    ? `Connected · ${live.tokens} tokens this session`
                    : 'Disconnected'}
                </span>
                <button
                  onClick={() => (live.connected ? live.disconnect() : void live.connect())}
                  disabled={live.status === 'connecting'}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${
                    live.connected
                      ? 'bg-rose-500/80 text-white hover:bg-rose-500'
                      : 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-400 hover:to-teal-400'
                  }`}
                >
                  {live.status === 'connecting'
                    ? 'Connecting…'
                    : live.connected
                      ? 'Disconnect'
                      : 'Connect'}
                </button>
              </div>
            </div>
          ) : (
          <div className="flex-shrink-0 border-t border-white/10 bg-white/[0.03] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <HeadsetTipBanner active={headsetTipActive} />
            <div className="mx-auto flex max-w-2xl items-center gap-2 sm:gap-3 pt-2">
              <MicButton
                size="sm"
                state={agent.state}
                handsFree={agent.handsFree}
                disabled={!agent.micSupported}
                onPressStart={agent.startListening}
                onPressEnd={agent.stopListening}
                onStop={agent.stopAll}
              />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitDraft()}
                placeholder={agent.micSupported ? '…or type a message' : 'Type a message (no mic needed)'}
                className="flex-1 rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-cyan-50 placeholder-cyan-200/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              />
              <button
                onClick={submitDraft}
                disabled={!draft.trim()}
                className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white disabled:opacity-40 hover:from-cyan-400 hover:to-teal-400 transition"
                aria-label="Send message"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          )}
        </section>

        {/* ---- Under-the-hood dev panel (opt-in, collapsible) ------------- */}
        {devView.enabled && (
          <div className="w-full max-w-sm shrink-0 border-l border-white/10 hidden md:block">
            <DevPanel trace={activeTrace} onClose={() => devView.setEnabled(false)} />
          </div>
        )}
      </div>

      {/* ---- Drawers + modals --------------------------------------------- */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        speech={agent.speech}
        wake={wake}
        hasApiKey={hasApiKey}
        onReplayIntro={() => {
          setSettingsOpen(false);
          setAboutOpen(false);
          reopenOnboarding();
        }}
      />

      <OnboardingWizard isOpen={showWizard} onComplete={() => completeOnboarding()} />
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}
