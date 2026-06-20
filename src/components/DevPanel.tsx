'use client';

import { useMemo, useState } from 'react';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { type TraceEvent, hasPricing } from '@/lib/devtrace';

/**
 * "Under the Hood" telemetry panel for Echo (docs/UNDER_THE_HOOD.md §4).
 *
 * Opt-in, purely observational: renders the most-recent turn's TraceEvent[]
 * as (a) a latency waterfall with the turn-total headline, (b) the turn-state
 * timeline, (c) per-call tokens + estimated $, (d) tool calls, and (e) raw
 * prompt/response/tool I/O behind accordions (default collapsed, §9). It never
 * drives the voice pipeline — it only reads what useVoiceAgent recorded.
 */

// Color per stage label / event kind for the waterfall bars.
function stageColor(label: string): string {
  if (label === 'turn-total') return 'bg-amber-400/80';
  if (label === 'stt') return 'bg-sky-400/80';
  if (label.startsWith('model')) return 'bg-cyan-400/80';
  if (label.startsWith('tts')) return 'bg-teal-400/80';
  return 'bg-cyan-300/70';
}

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '–';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtCost(usd: number): string {
  if (usd <= 0) return '$0.000000';
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(4)}`;
}

/** A collapsible raw-data accordion, default collapsed (§9). */
function RawAccordion({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <div className="mt-1.5 rounded-md border border-white/10 bg-black/20">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] font-medium text-cyan-200/70 hover:text-cyan-100"
        aria-expanded={open}
      >
        <ChevronDownIcon
          className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`}
        />
        {label}
      </button>
      {open && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words px-2 pb-2 text-[11px] leading-snug text-cyan-100/80">
          {text || '(empty)'}
        </pre>
      )}
    </div>
  );
}

export default function DevPanel({
  trace,
  onClose,
}: {
  trace: TraceEvent[];
  onClose: () => void;
}) {
  const stages = useMemo(
    () => trace.filter((e): e is Extract<TraceEvent, { kind: 'stage' }> => e.kind === 'stage'),
    [trace]
  );
  const states = useMemo(
    () => trace.filter((e): e is Extract<TraceEvent, { kind: 'state' }> => e.kind === 'state'),
    [trace]
  );
  const modelCalls = useMemo(
    () =>
      trace.filter(
        (e): e is Extract<TraceEvent, { kind: 'model_call' }> => e.kind === 'model_call'
      ),
    [trace]
  );
  const toolCalls = useMemo(
    () =>
      trace.filter(
        (e): e is Extract<TraceEvent, { kind: 'tool_exec' }> => e.kind === 'tool_exec'
      ),
    [trace]
  );

  const turnTotal = stages.find((s) => s.label === 'turn-total');

  // Waterfall time window: earliest start -> latest end across timed events.
  const timed = stages.filter((s) => s.label !== 'turn-total');
  const minStart = timed.length ? Math.min(...timed.map((s) => s.startedAt)) : 0;
  const maxEnd = timed.length ? Math.max(...timed.map((s) => s.endedAt)) : 0;
  const span = Math.max(1, maxEnd - minStart);

  const totalCost = modelCalls.reduce((sum, c) => sum + c.costUsd, 0);

  const header = (
    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-cyan-100">Under the hood</span>
        {turnTotal && (
          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">
            turn-total {fmtMs(turnTotal.endedAt - turnTotal.startedAt)}
          </span>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Close dev panel"
        className="rounded-md p-1 text-cyan-200/70 transition hover:bg-white/5 hover:text-cyan-100"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );

  if (trace.length === 0) {
    return (
      <aside className="flex h-full w-full flex-col bg-slate-950/60 text-cyan-50">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-medium text-cyan-100/80">No turn captured yet</p>
          <p className="max-w-xs text-xs text-cyan-200/50">
            Say something or send a message. This panel will trace the live
            pipeline — STT, first token, the model call (tokens + estimated
            cost), any tool calls, and where the milliseconds go.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-slate-950/60 text-cyan-50">
      {header}

      <div className="space-y-4 px-3 py-3">
        {/* ---- Latency waterfall ------------------------------------------ */}
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-200/60">
            Latency waterfall
          </h3>
          {timed.length === 0 ? (
            <p className="text-xs text-cyan-200/40">No timed stages yet.</p>
          ) : (
            <div className="space-y-1">
              {timed.map((s) => {
                const left = ((s.startedAt - minStart) / span) * 100;
                const width = Math.max(1.5, ((s.endedAt - s.startedAt) / span) * 100);
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 truncate text-[11px] text-cyan-200/70">
                      {s.label}
                    </span>
                    <div className="relative h-3 flex-1 rounded bg-white/5">
                      <div
                        className={`absolute top-0 h-3 rounded ${stageColor(s.label)}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${s.label}: ${fmtMs(s.endedAt - s.startedAt)}`}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-cyan-100/80">
                      {fmtMs(s.endedAt - s.startedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ---- Turn-state timeline ---------------------------------------- */}
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-200/60">
            Turn-state timeline
          </h3>
          {states.length === 0 ? (
            <p className="text-xs text-cyan-200/40">No transitions yet.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-cyan-200/70">
                {states[0].from}
              </span>
              {states.map((st) => (
                <span key={`${st.from}-${st.to}-${st.at}`} className="flex items-center gap-1.5">
                  <span className="text-cyan-200/40">→</span>
                  <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-cyan-200">
                    {st.to}
                  </span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ---- Model calls (tokens + estimated $) ------------------------- */}
        <section>
          <h3 className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-cyan-200/60">
            <span>Model calls</span>
            {totalCost > 0 && (
              <span className="font-mono text-[10px] normal-case text-cyan-200/50">
                est. total {fmtCost(totalCost)}
              </span>
            )}
          </h3>
          {modelCalls.length === 0 ? (
            <p className="text-xs text-cyan-200/40">No model call recorded.</p>
          ) : (
            <div className="space-y-2">
              {modelCalls.map((c) => (
                <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                    <span className="font-medium text-cyan-100">{c.model}</span>
                    <span className="text-cyan-200/50">{c.phase}</span>
                    <span className="ml-auto tabular-nums text-cyan-200/80">
                      {fmtMs(c.endedAt - c.startedAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-cyan-200/70">
                    <span>in {c.tokensIn}</span>
                    <span>out {c.tokensOut}</span>
                    <span className="text-cyan-200/90">
                      {hasPricing(c.model) ? `est. ${fmtCost(c.costUsd)}` : 'no $ rate'}
                    </span>
                  </div>
                  {c.prompt !== undefined && <RawAccordion label="prompt" value={c.prompt} />}
                  {c.rawResponse !== undefined && (
                    <RawAccordion label="raw response" value={c.rawResponse} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- Tool calls -------------------------------------------------- */}
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-200/60">
            Tool calls
          </h3>
          {toolCalls.length === 0 ? (
            <p className="text-xs text-cyan-200/40">No tools called this turn.</p>
          ) : (
            <div className="space-y-2">
              {toolCalls.map((t) => (
                <div key={t.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-medium text-cyan-100">{t.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        t.ok
                          ? 'bg-teal-500/15 text-teal-300'
                          : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      {t.ok ? 'ok' : 'error'}
                    </span>
                    <span className="ml-auto tabular-nums text-cyan-200/80">
                      {fmtMs(t.endedAt - t.startedAt)}
                    </span>
                  </div>
                  <RawAccordion label="args" value={t.args} />
                  {t.rawResult !== undefined && (
                    <RawAccordion label="raw result" value={t.rawResult} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
