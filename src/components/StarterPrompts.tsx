'use client';

/**
 * Clickable starter-prompt chips shown near the orb in the idle/empty state.
 * Clicking one sends that text as a turn (reusing the text-input path) and Echo
 * speaks the reply. The set comes from the active persona.
 */
export default function StarterPrompts({
  prompts,
  onPick,
}: {
  prompts: string[];
  onPick: (text: string) => void;
}) {
  if (prompts.length === 0) return null;
  return (
    <div className="flex flex-col items-center gap-2 max-w-xl">
      <p className="text-xs text-cyan-200/50">Try saying</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="rounded-full border border-cyan-500/30 bg-white/5 px-3.5 py-1.5 text-xs text-cyan-100/90 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
