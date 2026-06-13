'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const TIP_DISMISSED_KEY = 'echo_headset_tip_dismissed';

const TIP_TEXT =
  "Headphones recommended — in hands-free mode Echo's mic can pick up its own voice and interrupt itself. Headphones prevent that.";

/**
 * Dismissible headset tip banner. Shows the first time hands-free is active and
 * persists dismissal in localStorage. A permanent version lives in the settings
 * drawer (see HeadsetNote).
 */
export function HeadsetTipBanner({ active }: { active: boolean }) {
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we read storage (avoids flash)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(TIP_DISMISSED_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(TIP_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (!active || dismissed) return null;

  return (
    <div className="mx-auto flex max-w-xl items-start gap-2 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-900/40 to-teal-900/30 px-3 py-2 text-xs text-cyan-100 shadow-sm shadow-cyan-500/10">
      <span className="text-base leading-none">🎧</span>
      <span className="flex-1 leading-snug">{TIP_TEXT}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss headset tip"
        className="rounded-md p-0.5 text-cyan-200/60 hover:text-cyan-100 hover:bg-white/10 transition"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Permanent headset note for the settings drawer. */
export function HeadsetNote() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-cyan-400/20 bg-cyan-900/20 px-3 py-2 text-xs text-cyan-100/90 leading-snug">
      <span className="text-base leading-none">🎧</span>
      <span>{TIP_TEXT}</span>
    </div>
  );
}
