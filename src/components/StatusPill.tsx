'use client';

import type { TurnState } from '@/lib/conversation/turnMachine';

const LABELS: Record<TurnState, { text: string; dot: string }> = {
  idle: { text: 'Tap to talk', dot: 'bg-gray-500' },
  listening: { text: 'Listening…', dot: 'bg-rose-500 animate-pulse' },
  thinking: { text: 'Thinking…', dot: 'bg-cyan-400 animate-pulse' },
  speaking: { text: 'Speaking…', dot: 'bg-teal-400 animate-pulse' },
};

export default function StatusPill({ state, tool }: { state: TurnState; tool?: string | null }) {
  const { text, dot } = LABELS[state];
  const label = tool && state === 'thinking' ? `Using ${tool.replace(/_/g, ' ')}…` : text;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 backdrop-blur-sm">
      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <span className="text-sm font-medium text-cyan-100/90">{label}</span>
    </div>
  );
}
