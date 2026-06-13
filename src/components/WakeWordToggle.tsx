'use client';

import { useWakeWord } from '@/hooks/useWakeWord';

type WakeWord = ReturnType<typeof useWakeWord>;

/**
 * Wake-word toggle. Enabled only when NEXT_PUBLIC_PICOVOICE_ACCESS_KEY is set;
 * otherwise it renders disabled with a clear hint on how to enable it. Listening
 * is on-device (Porcupine) and only runs while this tab is open.
 */
export default function WakeWordToggle({ wake }: { wake: WakeWord }) {
  if (!wake.available) {
    return (
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs text-cyan-200/40 cursor-not-allowed">
          <input type="checkbox" disabled className="accent-cyan-400" />
          Wake word <span className="text-cyan-200/30">(disabled)</span>
        </label>
        <p className="text-[11px] text-cyan-200/40 leading-snug">
          Add a free Picovoice access key (<code className="text-cyan-300/70">NEXT_PUBLIC_PICOVOICE_ACCESS_KEY</code>)
          to enable hands-free wake word — trains a custom &quot;Hey Echo&quot; in the Picovoice console.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs text-cyan-200/80 cursor-pointer">
        <input
          type="checkbox"
          checked={wake.enabled}
          onChange={wake.toggle}
          className="accent-cyan-400"
        />
        Wake word{' '}
        <span className="text-cyan-200/40">
          (say &quot;{wake.keyword}&quot;
          {wake.status === 'starting' && ' — starting…'}
          {wake.status === 'listening' && ' — listening'}
          {')'}
        </span>
      </label>
      {wake.error && <p className="text-[11px] text-rose-400 leading-snug">{wake.error}</p>}
      <p className="text-[11px] text-cyan-200/40 leading-snug">
        On-device detection. Only works while this tab is open — a web app can&apos;t listen in the
        background. Chrome/Edge + mic permission required.
      </p>
    </div>
  );
}
