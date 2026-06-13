'use client';

import { useEffect, useState } from 'react';
import {
  InformationCircleIcon,
  PaperAirplaneIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useApiKey } from '@/hooks/useApiKey';
import { useUsageInfo } from '@/hooks/useUsageInfo';
import { usePersona } from '@/hooks/usePersona';
import { useWakeWord } from '@/hooks/useWakeWord';
import VoiceOrb from '@/components/VoiceOrb';
import StatusPill from '@/components/StatusPill';
import LiveCaptions from '@/components/LiveCaptions';
import MicButton from '@/components/MicButton';
import StarterPrompts from '@/components/StarterPrompts';
import OnboardingWizard from '@/components/OnboardingWizard';
import AboutModal from '@/components/AboutModal';
import PersonaSwitcher from '@/components/PersonaSwitcher';
import ModeToggle from '@/components/ModeToggle';
import VoiceQuickSelect from '@/components/VoiceQuickSelect';
import { UsagePill } from '@/components/UsageMeter';
import SettingsDrawer from '@/components/SettingsDrawer';
import ChatRail from '@/components/ChatRail';
import { HeadsetTipBanner } from '@/components/HeadsetTip';

export default function StagePage() {
  const { persona, personaId, selectPersona, personas } = usePersona();
  const agent = useVoiceAgent({ systemPrompt: persona.systemPrompt });
  const { showWizard, completeOnboarding, reopenOnboarding } = useOnboarding();
  const { hasApiKey } = useApiKey();
  const usage = useUsageInfo();
  const wake = useWakeWord({ onWake: () => agent.startListening() });

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

  const orbClick = () => {
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
      <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 z-10 border-b border-white/5">
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
          {agent.micSupported && (
            <ModeToggle handsFree={agent.handsFree} onChange={agent.setHandsFree} />
          )}
          <VoiceQuickSelect speech={agent.speech} />
          <UsagePill usage={usage} />
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
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-6 overflow-y-auto">
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
          </div>

          {/* ---- Bottom dock (persistent) --------------------------------- */}
          <div className="flex-shrink-0 border-t border-white/10 bg-white/[0.03] px-4 py-3">
            <HeadsetTipBanner active={headsetTipActive} />
            <div className="mx-auto flex max-w-2xl items-center gap-3 pt-2">
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
        </section>
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
