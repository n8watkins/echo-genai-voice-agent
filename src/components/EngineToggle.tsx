'use client';

import type { VoiceEngine } from '@/hooks/useVoiceEngine';

/**
 * Segmented Classic | Live toggle for the top bar (docs/UNDER_THE_HOOD.md §4d).
 * Switches the voice backend underneath the same UI: the hand-built pipeline
 * vs. Gemini's native Live API. Switching to Live does NOT open a socket — the
 * user still has to click Connect on the stage (TPM budget).
 */
export default function EngineToggle({
  engine,
  onChange,
  disabled,
}: {
  engine: VoiceEngine;
  onChange: (engine: VoiceEngine) => void;
  disabled?: boolean;
}) {
  const base =
    'px-2.5 sm:px-3 py-1 text-xs font-medium rounded-full transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40';
  const active =
    'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-sm shadow-cyan-500/30';
  const inactive = 'text-cyan-200/70 hover:text-cyan-100';
  return (
    <div
      role="radiogroup"
      aria-label="Voice engine"
      className={`inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5 ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <button
        role="radio"
        aria-checked={engine === 'classic'}
        disabled={disabled}
        onClick={() => onChange('classic')}
        title="Classic — the hand-built pipeline (Web Speech STT + streamed text + browser TTS)"
        className={`${base} ${engine === 'classic' ? active : inactive}`}
      >
        Classic
      </button>
      <button
        role="radio"
        aria-checked={engine === 'live'}
        disabled={disabled}
        onClick={() => onChange('live')}
        title="Live — Gemini's native Live API (realtime PCM audio over WebSocket)"
        className={`${base} ${engine === 'live' ? active : inactive}`}
      >
        Live
      </button>
    </div>
  );
}
