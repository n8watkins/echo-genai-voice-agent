'use client';

import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';
import type { TurnState } from '@/lib/conversation/turnMachine';

/**
 * Push-to-talk control (default). Press and hold to talk, release to send;
 * also supports a tap-to-toggle for accessibility. Turns rose when live.
 */
export default function MicButton({
  state,
  handsFree,
  disabled,
  onPressStart,
  onPressEnd,
  onStop,
}: {
  state: TurnState;
  handsFree: boolean;
  disabled?: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  onStop: () => void;
}) {
  const live = state === 'listening';
  const active = state !== 'idle';

  if (disabled) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          disabled
          className="w-16 h-16 rounded-full bg-gray-700/60 flex items-center justify-center text-gray-400 cursor-not-allowed"
          aria-label="Microphone unavailable"
        >
          <MicrophoneIcon className="w-7 h-7" />
        </button>
        <span className="text-xs text-gray-400">No mic — type below</span>
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
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
            live
              ? 'bg-rose-500 shadow-rose-500/50 scale-105'
              : 'bg-gradient-to-br from-cyan-500 to-teal-500 shadow-cyan-500/40 hover:scale-105'
          }`}
          aria-label={active ? 'Stop' : 'Start hands-free conversation'}
        >
          {active ? <StopIcon className="w-7 h-7 text-white" /> : <MicrophoneIcon className="w-7 h-7 text-white" />}
        </button>
        <span className="text-xs text-cyan-200/70">{active ? 'Tap to stop' : 'Tap to start'}</span>
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
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg select-none touch-none ${
          live
            ? 'bg-rose-500 shadow-rose-500/50 scale-110'
            : 'bg-gradient-to-br from-cyan-500 to-teal-500 shadow-cyan-500/40 hover:scale-105'
        }`}
        aria-label="Hold to talk"
      >
        <MicrophoneIcon className="w-7 h-7 text-white" />
      </button>
      <span className="text-xs text-cyan-200/70">{live ? 'Release to send' : 'Hold to talk'}</span>
    </div>
  );
}
