'use client';

/**
 * Segmented Conversation | Push toggle for the top bar.
 * Conversation = hands-free + barge-in (the default); Push = push-to-talk.
 * Wired to the agent's hands-free state via setHandsFree.
 */
export default function ModeToggle({
  handsFree,
  onChange,
  disabled,
}: {
  handsFree: boolean;
  onChange: (handsFree: boolean) => void;
  disabled?: boolean;
}) {
  const base =
    'px-2.5 sm:px-3 py-1 text-xs font-medium rounded-full transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40';
  return (
    <div
      role="radiogroup"
      aria-label="Conversation mode"
      className={`inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5 ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <button
        role="radio"
        aria-checked={handsFree}
        disabled={disabled}
        onClick={() => onChange(true)}
        title="Hands-free — Echo listens continuously and you can interrupt it"
        className={`${base} ${
          handsFree
            ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-sm shadow-cyan-500/30'
            : 'text-cyan-200/70 hover:text-cyan-100'
        }`}
      >
        Conversation
      </button>
      <button
        role="radio"
        aria-checked={!handsFree}
        disabled={disabled}
        onClick={() => onChange(false)}
        title="Push-to-talk — hold the mic button to speak"
        className={`${base} ${
          !handsFree
            ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-sm shadow-cyan-500/30'
            : 'text-cyan-200/70 hover:text-cyan-100'
        }`}
      >
        Push
      </button>
    </div>
  );
}
