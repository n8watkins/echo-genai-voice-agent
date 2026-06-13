'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { Persona } from '@/lib/personas';

/**
 * Compact persona switcher for the top bar. Shows the active persona's
 * emoji + name and opens a menu over the same usePersona data. Selecting a
 * persona swaps the system prompt / voice hint / starter prompts as before.
 */
export default function PersonaSwitcher({
  personas,
  activeId,
  onSelect,
}: {
  personas: Persona[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = personas.find((p) => p.id === activeId) ?? personas[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Persona: ${active.name}. Change persona`}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 pl-2 pr-1.5 py-1 text-sm text-cyan-50 hover:border-cyan-500/40 hover:bg-white/[0.08] transition"
      >
        <span className="text-base leading-none">{active.emoji}</span>
        <span className="hidden sm:inline max-w-[8rem] truncate">{active.name}</span>
        <ChevronDownIcon className="w-4 h-4 text-cyan-200/60" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-2 w-72 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-gray-950/95 backdrop-blur-md p-2 shadow-xl shadow-black/40 z-30"
        >
          {personas.map((p) => {
            const isActive = p.id === activeId;
            return (
              <button
                key={p.id}
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
                className={`w-full text-left rounded-xl px-2.5 py-2 flex items-start gap-2.5 transition ${
                  isActive
                    ? 'bg-gradient-to-br from-cyan-900/40 to-teal-900/40 border border-cyan-400/40'
                    : 'border border-transparent hover:bg-white/[0.06]'
                }`}
              >
                <span className="text-xl leading-none mt-0.5">{p.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-cyan-50">{p.name}</span>
                    {isActive && <CheckCircleIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                  </span>
                  <span className="block text-xs text-cyan-100/60 leading-snug">{p.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
