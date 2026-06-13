'use client';

import React, { useEffect, useState } from 'react';
import { XMarkIcon, SparklesIcon, ChevronLeftIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import AboutContent from './AboutContent';
import InlineKeyEntry from './InlineKeyEntry';
import { PoolMeterBar } from './UsageMeter';
import { useUsageInfo } from '@/hooks/useUsageInfo';
import { useApiKey } from '@/hooks/useApiKey';
import { isSpeechRecognitionSupported } from '@/hooks/useSpeechRecognition';

interface OnboardingWizardProps {
  isOpen: boolean;
  /** Marks onboarding complete and closes; receives whether mic was enabled. */
  onComplete: (micEnabled: boolean) => void;
}

const STEPS = ['About', 'How to talk to it', 'Enable mic'] as const;

/**
 * First-run three-step onboarding wizard (plan §8). Cyan reskin of
 * gemini-chat-app's wizard, with an extra microphone-permission step.
 */
export default function OnboardingWizard({ isOpen, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [showKeyEntry, setShowKeyEntry] = useState(false);
  const [micStatus, setMicStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [isChrome, setIsChrome] = useState(true);
  const usage = useUsageInfo();
  const { hasApiKey } = useApiKey();

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    setIsChrome(isSpeechRecognitionSupported());
  }, []);

  const enableMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We only needed the permission; release the tracks immediately.
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus('granted');
    } catch {
      setMicStatus('denied');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[50000] flex items-center justify-center p-4"
      data-testid="onboarding-wizard"
    >
      <div
        className="bg-gray-900 rounded-2xl max-w-5xl w-full border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 relative max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: step pills + skip */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                {i > 0 && <div className="w-8 h-px bg-white/20" />}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      step === i
                        ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md'
                        : step > i
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/10 text-cyan-200/50'
                    }`}
                  >
                    {step > i ? '✓' : i + 1}
                  </span>
                  <span
                    className={`text-sm font-medium hidden sm:inline ${
                      step === i ? 'text-white' : 'text-cyan-200/40'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
          <button
            onClick={() => onComplete(micStatus === 'granted')}
            className="text-cyan-200/60 hover:text-cyan-100 transition-colors"
            aria-label="Skip intro"
            title="Skip intro"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div data-testid="onboarding-step-about">
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-cyan-900/30 to-teal-900/30 border border-cyan-500/30 flex items-start gap-3">
                <SparklesIcon className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-cyan-50/90">
                  <span className="font-bold text-white">
                    Echo listens, thinks, and talks back in real time
                  </span>{' '}
                  — and you can interrupt it mid-sentence, like a real conversation. Closing that
                  spoken loop is the heart of this project.
                </p>
              </div>
              <AboutContent />
            </div>
          )}

          {step === 1 && (
            <div data-testid="onboarding-step-how" className="max-w-2xl mx-auto space-y-6">
              <div className="text-center">
                <h2 className="text-white text-3xl font-bold mb-2">How to talk to it</h2>
                <p className="text-cyan-100/70 text-sm">The whole loop happens in about a second.</p>
              </div>

              {/* Pipeline mini-diagram */}
              <div className="flex items-center justify-center gap-3 sm:gap-5">
                <PipeNode emoji="🎙️" label="You speak" />
                <Arrow />
                <PipeNode emoji="🧠" label="Gemini thinks" />
                <Arrow />
                <PipeNode emoji="🔊" label="Echo speaks" />
              </div>

              <ul className="space-y-2 text-sm text-cyan-50/90">
                <li className="flex gap-2">
                  <span className="text-cyan-400">•</span> Tap the orb (or hold the mic button) to start
                  talking.
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400">•</span> Talk over Echo to interrupt it — it stops and
                  listens.
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400">•</span> Try: <em>&quot;what&apos;s the weather in Paris
                  and the time in Tokyo?&quot;</em>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400">•</span> No mic? Just type — the text box always works.
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400">•</span> Open the panel to switch <em>personas</em> —
                  Witty Mentor, Noir Detective, Hype Coach, and more — each with its own voice.
                </li>
              </ul>

              {!isChrome && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
                  Heads up: your browser doesn&apos;t support voice input. <strong>Chrome or Edge on
                  desktop</strong> works best. You can still use the typed demo here.
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div data-testid="onboarding-step-mic" className="max-w-2xl mx-auto space-y-5">
              <div className="text-center">
                <h2 className="text-white text-3xl font-bold mb-2">You can talk right now</h2>
                <p className="text-cyan-100/70 text-sm">
                  No signup, no API key — it runs on a shared free demo key while it has capacity.
                  Speech-to-text and text-to-speech run entirely in your browser.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-900/30 to-teal-900/30 border border-cyan-500/30">
                <PoolMeterBar usage={usage} />
              </div>

              {/* Enable microphone */}
              <div className="text-center space-y-2">
                <button
                  onClick={enableMic}
                  disabled={!isChrome}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold shadow-lg hover:from-cyan-400 hover:to-teal-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MicrophoneIcon className="w-5 h-5" />
                  Enable microphone
                </button>
                {micStatus === 'granted' && (
                  <p className="text-sm text-emerald-400">Microphone enabled — you&apos;re all set.</p>
                )}
                {micStatus === 'denied' && (
                  <p className="text-sm text-rose-400">
                    Mic blocked — no problem. You can type your messages instead.
                  </p>
                )}
                {!isChrome && (
                  <p className="text-sm text-amber-200">
                    Voice input needs Chrome/Edge. The typed demo works everywhere.
                  </p>
                )}
              </div>

              {/* BYOK expander */}
              <div className="rounded-xl border border-white/10">
                <button
                  onClick={() => setShowKeyEntry(!showKeyEntry)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left text-sm text-cyan-100/80 hover:bg-white/5 rounded-xl transition-colors"
                  data-testid="onboarding-byok-toggle"
                >
                  <span>
                    {hasApiKey
                      ? 'Your own Gemini key is active'
                      : 'Prefer your own free Gemini key? (optional — unlimited usage)'}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showKeyEntry ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {(showKeyEntry || hasApiKey) && (
                  <div className="px-4 pb-4">
                    <InlineKeyEntry />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-3">
          {step === 0 ? (
            <button
              onClick={() => onComplete(micStatus === 'granted')}
              className="px-4 py-2 text-sm text-cyan-200/60 hover:text-cyan-100 transition-colors"
            >
              Skip intro
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
              className="px-4 py-2 text-sm text-cyan-200/60 hover:text-cyan-100 transition-colors flex items-center gap-1"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back
            </button>
          )}

          {step < 2 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 0 | 1 | 2)}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              data-testid="onboarding-next"
            >
              {step === 0 ? 'Next: How to talk to it →' : 'Next: Enable mic →'}
            </button>
          ) : (
            <button
              onClick={() => onComplete(micStatus === 'granted')}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              data-testid="onboarding-start-talking"
            >
              Start talking →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PipeNode({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/5 border border-cyan-500/30 flex items-center justify-center text-3xl">
        {emoji}
      </div>
      <span className="text-xs text-cyan-100/80 font-medium">{label}</span>
    </div>
  );
}

function Arrow() {
  return <span className="text-cyan-400 text-2xl">→</span>;
}
