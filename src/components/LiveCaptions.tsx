'use client';

/**
 * Big accessibility-style captions under the orb. Shows the live interim
 * transcript while listening, and Echo's streaming reply while it speaks.
 */
export default function LiveCaptions({
  interim,
  reply,
}: {
  interim: string;
  reply: string;
}) {
  const text = interim || reply;
  if (!text) {
    return (
      <p className="text-center text-base sm:text-lg text-cyan-100/30 italic min-h-[2.5rem] sm:min-h-[3.5rem] max-w-2xl">
        Say something, or type below…
      </p>
    );
  }
  const isUser = !!interim;
  return (
    <p
      className={`text-center text-xl sm:text-2xl leading-snug font-medium min-h-[2.5rem] sm:min-h-[3.5rem] max-w-2xl ${
        isUser ? 'text-rose-100' : 'text-cyan-50'
      }`}
      aria-live="polite"
    >
      {text}
    </p>
  );
}
