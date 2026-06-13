import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lightweight in-memory demo-pool meter. Mirrors the portfolio contract:
 *   GET /api/usage -> { pool: { used, budget, resetAt, available }, user }
 *
 * The pool is per-server-process and resets on a rolling 24h window — plenty
 * for a portfolio demo on a free tier. BYOK requests don't draw down the pool.
 */

const BUDGET = 500; // demo requests per window
const WINDOW_MS = 24 * 60 * 60 * 1000;

let used = 0;
let windowStart = Date.now();

function rollWindow() {
  if (Date.now() - windowStart >= WINDOW_MS) {
    used = 0;
    windowStart = Date.now();
  }
}

/** Called by /api/chat after a successful generation. */
export function recordUsage(source: 'byok' | 'demo') {
  rollWindow();
  if (source === 'demo') used += 1;
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
