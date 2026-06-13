import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lightweight demo-pool meter for the shared Gemini key.
 *   GET /api/usage -> { pool: { used, budget, resetAt, available } }
 *
 * IMPORTANT: this counter is IN-MEMORY and PER-PROCESS. On Render's free tier
 * the instance cold-starts (and resets `used`) after idle spin-down, so this is
 * a best-effort soft guard, not a hard global ceiling. A durable, cross-process
 * cap would store the rolling counter in an external KV (e.g. Upstash Redis)
 * keyed by day — intentionally not added here to keep the demo dependency-free.
 *
 * The shared demo key is used by more than one portfolio app, so we count
 * EVERY actual model call (a single chat turn can fire up to MAX_TOOL_ROUNDS
 * `generateContentStream` calls) — and we count even on error/abort once the
 * model has been hit. BYOK requests never draw down the pool.
 */

const BUDGET = 250; // demo model CALLS per rolling 24h window
const WINDOW_MS = 24 * 60 * 60 * 1000;

let used = 0;
let windowStart = Date.now();

function rollWindow() {
  if (Date.now() - windowStart >= WINDOW_MS) {
    used = 0;
    windowStart = Date.now();
  }
}

/**
 * Called by /api/chat once per ACTUAL `generateContentStream` call against the
 * demo key — including calls that subsequently error or are aborted, since the
 * model was still hit. BYOK calls pass source 'byok' and are not counted.
 */
export function recordModelCall(source: 'byok' | 'demo') {
  rollWindow();
  if (source === 'demo') used += 1;
}

/**
 * True when the shared demo pool is at/over budget for this window. BYOK
 * requests bypass this check entirely.
 */
export function demoPoolExhausted(): boolean {
  rollWindow();
  return used >= BUDGET;
}

export async function GET() {
  rollWindow();
  const resetAt = new Date(windowStart + WINDOW_MS).toISOString();
  return NextResponse.json({
    pool: {
      used,
      budget: BUDGET,
      resetAt,
      available: Math.max(0, BUDGET - used),
    },
  });
}
