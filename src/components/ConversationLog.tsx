'use client';

import { useEffect, useRef } from 'react';
import type { LogTurn } from '@/hooks/useVoiceAgent';

export default function ConversationLog({
  log,
  partialReply,
}: {
  log: LogTurn[];
  partialReply?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log, partialReply]);

  if (log.length === 0 && !partialReply) {
    return (
      <p className="text-sm text-cyan-200/40 italic px-1">
        Your conversation will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {log.map((turn) => (
        <Bubble key={turn.id} role={turn.role} text={turn.text} />
      ))}
      {partialReply && <Bubble role="assistant" text={partialReply} streaming />}
      <div ref={endRef} />
    </div>
  );
}

function Bubble({
  role,
  text,
  streaming,
}: {
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
          isUser
            ? 'bg-rose-500/20 border border-rose-400/30 text-rose-50'
            : 'bg-cyan-500/10 border border-cyan-400/20 text-cyan-50'
        }`}
      >
        {text}
        {streaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-cyan-300 animate-pulse align-middle" />}
      </div>
    </div>
  );
}
