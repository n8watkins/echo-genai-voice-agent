'use client';

import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';
import type { TurnState } from '@/lib/conversation/turnMachine';

/**
 * Mic control. In the default hands-free mode it tap-toggles a continuous
 * session; in the push-to-talk mode it captures while held (release to send).
 * Turns rose when live.
 *
 * `size` controls the footprint without losing the caption label or the
 * press/scale feedback: "lg" is the centre-stage button, "sm" is the inline
 * bottom-dock variant.
 */
export default function MicButton({
  state,
  handsFree,
  disabled,
  size = 'lg',
  onPressStart,
  onPressEnd,
  onStop,
}: {
  state: TurnState;
  handsFree: boolean;
  disabled?: boolean;
  size?: 'sm' | 'lg';
  onPressStart: () => void;
  onPressEnd: () => void;
  onStop: () => void;
}) {
  const live = state === 'listening';
  const active = state !== 'idle';

  // Size-dependent classes. The label and scale feedback are kept in both.
  const buttonSize = size === 'sm' ? 'w-12 h-12' : 'w-16 h-16';
  const iconSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';
  const labelSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const activeScale = size === 'sm' ? 'scale-105' : 'scale-110';

  if (disabled) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          disabled
          className={`${buttonSize} rounded-full bg-gray-700/60 flex items-center justify-center text-gray-400 cursor-not-allowed`}
          aria-label="Microphone unavailable"
        >
          <MicrophoneIcon className={iconSize} />
        </button>
        <span className={`${labelSize} text-gray-400 whitespace-nowrap`}>No mic — type below</span>
      </div>
    );
  }

  // In hands-free mode the button toggles a continuous session; in push-to-talk
  // it captures while held.
  if (handsFree) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={active ? onStop : onPressStart}
          className={`${buttonSize} rounded-full flex items-center justify-center transition-all shadow-lg ${
            live
              ? `bg-rose-500 shadow-rose-500/50 ${size === 'sm' ? 'scale-105' : 'scale-105'}`
              : 'bg-gradient-to-br from-cyan-500 to-teal-500 shadow-cyan-500/40 hover:scale-105'
          }`}
          aria-label={active ? 'Stop' : 'Start hands-free conversation'}
        >
          {active ? <StopIcon className={`${iconSize} text-white`} /> : <MicrophoneIcon className={`${iconSize} text-white`} />}
        </button>
        <span className={`${labelSize} text-cyan-200/70 whitespace-nowrap`}>{active ? 'Tap to stop' : 'Tap to start'}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onMouseLeave={(e) => {
          // Only end if the button is being held.
          if (live) onPressEnd();
          e.currentTarget.blur();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          onPressStart();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onPressEnd();
        }}
        className={`${buttonSize} rounded-full flex items-center justify-center transition-all shadow-lg select-none touch-none ${
          live
            ? `bg-rose-500 shadow-rose-500/50 ${activeScale}`
            : 'bg-gradient-to-br from-cyan-500 to-teal-500 shadow-cyan-500/40 hover:scale-105'
        }`}
        aria-label="Hold to talk"
      >
        <MicrophoneIcon className={`${iconSize} text-white`} />
      </button>
      <span className={`${labelSize} text-cyan-200/70 whitespace-nowrap`}>{live ? 'Release to send' : 'Hold to talk'}</span>
    </div>
  );
}
