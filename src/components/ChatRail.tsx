'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { LogTurn } from '@/hooks/useVoiceAgent';
import type { ConvSummary } from '@/hooks/useConversations';
import ConversationLog from './ConversationLog';

/**
 * Collapsible left rail (chat-app style). Holds the saved-conversations list
 * (when signed in) plus the active/viewed transcript and New/Clear actions.
 * On desktop it's an inline column; on mobile it becomes an overlay drawer.
 */
export default function ChatRail({
  open,
  onClose,
  log,
  partialReply,
  onNew,
  onClear,
  saved,
  onOpenSaved,
  onDeleteSaved,
  viewingId,
  signedIn,
  onSignIn,
}: {
  open: boolean;
  onClose: () => void;
  log: LogTurn[];
  partialReply: string;
  onNew: () => void;
  onClear: () => void;
  saved: ConvSummary[];
  onOpenSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  viewingId: string | null;
  signedIn: boolean;
  onSignIn: () => void;
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

      {/* Saved conversations (signed in) or a sign-in nudge */}
      {signedIn ? (
        saved.length > 0 && (
          <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02] p-1">
            {saved.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition ${
                  viewingId === c.id
                    ? 'bg-cyan-500/15 text-cyan-100'
                    : 'text-cyan-200/70 hover:bg-white/5'
                }`}
              >
                <button
                  onClick={() => onOpenSaved(c.id)}
                  className="flex-1 truncate text-left"
                  title={c.title}
                >
                  {c.title || 'Conversation'}
                </button>
                <button
                  onClick={() => onDeleteSaved(c.id)}
                  aria-label="Delete saved conversation"
                  className="text-cyan-200/40 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <button
          onClick={onSignIn}
          className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-xs leading-snug text-cyan-200/60 transition hover:border-cyan-400/40 hover:text-cyan-100"
        >
          <span className="font-medium text-cyan-100/90">Sign in with GitHub</span> to save your
          conversations and pick them back up later.
        </button>
      )}

      {/* Active / viewed transcript */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02] p-2">
        {viewingId && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200/80">
            <span>Viewing a saved chat</span>
            <button onClick={onNew} className="underline hover:text-cyan-100">
              back to current
            </button>
          </div>
        )}
        {empty ? (
          <p className="px-1 py-2 text-xs text-cyan-200/40 leading-snug">
            Your conversation transcript will appear here.
          </p>
        ) : (
          <ConversationLog log={log} partialReply={partialReply} />
        )}
      </div>

      {!empty && !viewingId && (
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
