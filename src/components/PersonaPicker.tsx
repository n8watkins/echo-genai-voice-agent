'use client';

import { CheckCircleIcon } from '@heroicons/react/24/solid';
import type { Persona } from '@/lib/personas';

/**
 * Persona picker — cards in the cyan/teal house style. Selecting a persona sets
 * the system prompt sent to /api/chat, auto-picks a matching voice, and swaps
 * the shown starter prompts. The choice persists in localStorage.
 */
export default function PersonaPicker({
  personas,
  activeId,
  onSelect,
}: {
  personas: Persona[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {personas.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            aria-pressed={active}
            className={`relative text-left rounded-2xl border px-3 py-2.5 transition flex items-start gap-3 ${
              active
                ? 'border-cyan-400/70 bg-gradient-to-br from-cyan-900/40 to-teal-900/40 shadow-md shadow-cyan-500/10'
                : 'border-white/10 bg-white/5 hover:border-cyan-500/40 hover:bg-white/[0.07]'
            }`}
          >
            <span className="text-2xl leading-none mt-0.5">{p.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-cyan-50">{p.name}</span>
                {active && <CheckCircleIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
              </span>
              <span className="block text-xs text-cyan-100/60 leading-snug">{p.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
