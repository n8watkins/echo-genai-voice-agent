'use client';

import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { useSpeech } from '@/hooks/useSpeech';
import type { useWakeWord } from '@/hooks/useWakeWord';
import VoicePicker from './VoicePicker';
import WakeWordToggle from './WakeWordToggle';
import InlineKeyEntry from './InlineKeyEntry';
import { HeadsetNote } from './HeadsetTip';

type SpeechApi = ReturnType<typeof useSpeech>;
type WakeApi = ReturnType<typeof useWakeWord>;

/**
 * Right-hand settings drawer (closed by default, opens from the top-bar gear).
 * Groups the controls that no longer belong in the main stage: full Voice
 * controls, wake word, a permanent headset note, BYOK (when no key), and a
 * replay-intro action.
 */
export default function SettingsDrawer({
  open,
  onClose,
  speech,
  wake,
  hasApiKey,
  onReplayIntro,
}: {
  open: boolean;
  onClose: () => void;
  speech: SpeechApi;
  wake: WakeApi;
  hasApiKey: boolean;
  onReplayIntro: () => void;
}) {
  const trapRef = useFocusTrap<HTMLElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className={`fixed right-0 top-0 z-50 h-dvh w-full max-w-sm overflow-y-auto border-l border-white/10 bg-gray-950/95 backdrop-blur-md p-5 shadow-2xl shadow-black/50 outline-none transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-cyan-100">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-cyan-200/70 hover:text-cyan-100 hover:bg-white/5 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <section>
            <h3 className="text-sm font-semibold text-cyan-100 mb-3">Voice</h3>
            <VoicePicker speech={speech} />
          </section>

          <section className="border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold text-cyan-100 mb-3">Hands-free wake word</h3>
            <WakeWordToggle wake={wake} />
          </section>

          <section className="border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold text-cyan-100 mb-2">🎧 Headset tip</h3>
            <HeadsetNote />
          </section>

          {!hasApiKey && (
            <section className="border-t border-white/10 pt-5">
              <h3 className="text-sm font-semibold text-cyan-100 mb-2">Bring your own key</h3>
              <InlineKeyEntry />
            </section>
          )}

          <section className="border-t border-white/10 pt-5">
            <button
              onClick={onReplayIntro}
              className="text-xs text-cyan-300 hover:text-cyan-200 underline"
            >
              Replay the intro
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
