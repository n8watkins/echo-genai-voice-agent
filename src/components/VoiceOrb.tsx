'use client';

import type { TurnState } from '@/lib/conversation/turnMachine';

/**
 * The emotional centerpiece. A CSS-driven orb that reflects the turn state:
 *  - idle:      gentle breathing pulse
 *  - listening: rose, with expanding ripple rings (mic is hot)
 *  - thinking:  cyan/teal shimmer (gradient pans)
 *  - speaking:  teal glow with a faster pulse, like a mouth
 */
export default function VoiceOrb({
  state,
  onClick,
}: {
  state: TurnState;
  onClick?: () => void;
}) {
  const listening = state === 'listening';
  const thinking = state === 'thinking';
  const speaking = state === 'speaking';

  const gradient = listening
    ? 'from-rose-500 via-rose-400 to-orange-400'
    : speaking
      ? 'from-teal-400 via-cyan-400 to-cyan-300'
      : 'from-cyan-500 via-teal-500 to-cyan-400';

  const glow = listening
    ? 'shadow-[0_0_80px_20px_rgba(244,63,94,0.45)]'
    : speaking
      ? 'shadow-[0_0_80px_24px_rgba(45,212,191,0.5)]'
      : 'shadow-[0_0_70px_18px_rgba(6,182,212,0.4)]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Voice orb — tap to talk"
      className="relative flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/50 rounded-full"
    >
      {/* Ripple rings while listening */}
      {listening && (
        <>
          <span className="absolute w-44 h-44 rounded-full border-2 border-rose-400/40 orb-ring" />
          <span
            className="absolute w-44 h-44 rounded-full border-2 border-rose-400/30 orb-ring"
            style={{ animationDelay: '0.6s' }}
          />
          <span
            className="absolute w-44 h-44 rounded-full border-2 border-rose-400/20 orb-ring"
            style={{ animationDelay: '1.2s' }}
          />
        </>
      )}

      {/* The orb */}
      <span
        className={[
          'relative w-44 h-44 rounded-full bg-gradient-to-br',
          gradient,
          glow,
          thinking ? 'orb-shimmer' : 'orb-idle',
          speaking ? '[animation-duration:1.4s]' : '',
        ].join(' ')}
      >
        {/* Inner highlight for a glassy blob look */}
        <span className="absolute inset-3 rounded-full bg-white/10 backdrop-blur-sm" />
        <span className="absolute top-7 left-9 w-12 h-12 rounded-full bg-white/30 blur-md" />
      </span>
    </button>
  );
}
