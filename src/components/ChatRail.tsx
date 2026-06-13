'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { LogTurn } from '@/hooks/useVoiceAgent';
import ConversationLog from './ConversationLog';

/**
 * Collapsible left rail (chat-app style). Holds the current conversation
 * transcript plus "New conversation" (clears the log) and Clear actions.
 * On desktop it's an inline column; on mobile it becomes an overlay drawer.
 *
 * Scope per spec: transcript + new/clear only — no multi-conversation store.
 */
export default function ChatRail({
  open,
  onClose,
  log,
  partialReply,
  onNew,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  log: LogTurn[];
  partialReply: string;
  onNew: () => void;
  onClear: () => void;
}) {
  const empty = log.length === 0 && !partialReply;

  // The mobile overlay is a modal; the desktop inline column is not. Only trap
  // focus / handle Esc when the overlay is actually shown (viewport < lg).
  const [isOverlay, setIsOverlay] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsOverlay(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const modalOpen = open && isOverlay;
  const trapRef = useFocusTrap<HTMLElement>(modalOpen);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen, onClose]);

  const inner = (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-cyan-200/60">Chats</h2>
        {/* Close button only matters on the mobile overlay */}
        <button
          onClick={onClose}
          aria-label="Close conversation panel"
          className="lg:hidden rounded-md p-1 text-cyan-200/60 hover:text-cyan-100 hover:bg-white/5 transition"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <button
        onClick={onNew}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/30 bg-white/5 px-3 py-2 text-xs font-medium text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition"
      >
        <PlusIcon className="w-4 h-4" /> New conversation
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02] p-2">
        {empty ? (
          <p className="px-1 py-2 text-xs text-cyan-200/40 leading-snug">
            Your conversation transcript will appear here.
          </p>
        ) : (
          <ConversationLog log={log} partialReply={partialReply} />
        )}
      </div>

      {!empty && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 self-start text-xs text-cyan-200/60 hover:text-cyan-100 transition"
        >
          <TrashIcon className="w-4 h-4" /> Clear
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop inline column */}
      <aside
        className={`hidden lg:flex flex-shrink-0 border-r border-white/10 bg-white/[0.03] transition-all duration-200 ${
          open ? 'w-72' : 'w-0 overflow-hidden border-r-0'
        }`}
      >
        {open && <div className="w-72">{inner}</div>}
      </aside>

      {/* Mobile overlay drawer */}
      <div
        onClick={onClose}
        aria-hidden
        className={`lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Conversations"
        tabIndex={-1}
        className={`lg:hidden fixed left-0 top-0 z-50 h-dvh w-80 max-w-[85vw] border-r border-white/10 bg-gray-950/95 backdrop-blur-md outline-none transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {inner}
      </aside>
    </>
  );
}
