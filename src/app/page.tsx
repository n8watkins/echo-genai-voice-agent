'use client';

import { useState } from 'react';
import {
  InformationCircleIcon,
  PaperAirplaneIcon,
  Bars3Icon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useApiKey } from '@/hooks/useApiKey';
import { useUsageInfo } from '@/hooks/useUsageInfo';
import VoiceOrb from '@/components/VoiceOrb';
import StatusPill from '@/components/StatusPill';
import LiveCaptions from '@/components/LiveCaptions';
import MicButton from '@/components/MicButton';
import VoicePicker from '@/components/VoicePicker';
import ConversationLog from '@/components/ConversationLog';
import InlineKeyEntry from '@/components/InlineKeyEntry';
import { PoolMeterBar } from '@/components/UsageMeter';
import OnboardingWizard from '@/components/OnboardingWizard';
import AboutModal from '@/components/AboutModal';

export default function StagePage() {
  const agent = useVoiceAgent();
  const { showWizard, completeOnboarding, reopenOnboarding } = useOnboarding();
  const { hasApiKey } = useApiKey();
  const usage = useUsageInfo();

  const [panelOpen, setPanelOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const orbClick = () => {
    if (agent.state === 'idle') agent.startListening();
    else agent.stopAll();
  };

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    agent.submitText(text);
    setDraft('');
  };

  return (
    <main className="echo-stage min-h-dvh flex flex-col text-cyan-50 relative overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
            Echo
          </span>
          <span className="hidden sm:inline text-xs text-cyan-200/50">realtime voice agent</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAboutOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 text-cyan-200/70 hover:text-cyan-100 transition"
            aria-label="About Echo"
          >
            <InformationCircleIcon className="w-6 h-6" />
          </button>
          <button
            onClick={() => setPanelOpen((p) => !p)}
            className="p-2 rounded-lg hover:bg-white/5 text-cyan-200/70 hover:text-cyan-100 transition"
            aria-label="Toggle panel"
          >
            {panelOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* Stage center */}
        <section className="flex-1 flex flex-col items-center justify-center gap-8 px-4 pb-8">
          <VoiceOrb state={agent.state} onClick={orbClick} />

          <StatusPill state={agent.state} tool={agent.activeTool} />

          <LiveCaptions interim={agent.interim} reply={agent.partialReply} />

          {agent.error && (
            <p className="text-sm text-rose-400 max-w-md text-center bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-2">
              {agent.error}
            </p>
          )}

          {/* Controls */}
          <div className="flex flex-col items-center gap-5 w-full max-w-xl">
            <div className="flex items-center justify-center gap-6">
              <MicButton
                state={agent.state}
                handsFree={agent.handsFree}
                disabled={!agent.micSupported}
                onPressStart={agent.startListening}
                onPressEnd={agent.stopListening}
                onStop={agent.stopAll}
              />
            </div>

            {agent.micSupported && (
              <label className="flex items-center gap-2 text-xs text-cyan-200/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agent.handsFree}
                  onChange={agent.toggleHandsFree}
                  className="accent-cyan-400"
                />
                Hands-free + barge-in <span className="text-cyan-200/40">(best-effort — may hear itself)</span>
              </label>
            )}

            {/* First-class text fallback */}
            <div className="w-full flex items-center gap-2">
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

        {/* Side panel */}
        {panelOpen && (
          <aside className="w-full sm:w-96 absolute sm:relative inset-0 sm:inset-auto bg-gray-950/95 sm:bg-white/5 backdrop-blur-md border-l border-white/10 p-5 overflow-y-auto z-20 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-cyan-100">Conversation</h2>
              <button
                onClick={agent.clearLog}
                className="flex items-center gap-1 text-xs text-cyan-200/60 hover:text-cyan-100"
              >
                <TrashIcon className="w-4 h-4" /> Clear
              </button>
            </div>
            <div className="flex-1 min-h-[8rem]">
              <ConversationLog log={agent.log} partialReply={agent.partialReply} />
            </div>

            <div className="border-t border-white/10 pt-4">
              <h3 className="text-sm font-semibold text-cyan-100 mb-3">Voice</h3>
              <VoicePicker speech={agent.speech} />
            </div>

            <div className="border-t border-white/10 pt-4">
              <h3 className="text-sm font-semibold text-cyan-100 mb-2">Usage</h3>
              <PoolMeterBar usage={usage} />
            </div>

            {!hasApiKey && (
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-semibold text-cyan-100 mb-2">Bring your own key</h3>
                <InlineKeyEntry />
              </div>
            )}

            <div className="border-t border-white/10 pt-4">
              <button
                onClick={() => {
                  setAboutOpen(false);
                  reopenOnboarding();
                }}
                className="text-xs text-cyan-300 hover:text-cyan-200 underline"
              >
                Replay the intro
              </button>
            </div>
          </aside>
        )}
      </div>

      <OnboardingWizard isOpen={showWizard} onComplete={() => completeOnboarding()} />
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}
