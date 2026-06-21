import { NextRequest } from 'next/server';
import { dispatchTool } from '@/lib/conversation/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tool executor for the Live engine (Mode B).
 *
 * The Live model runs in the browser (direct WebSocket to Gemini), so when it
 * emits a function call the browser POSTs {name, args} here. We run the SAME
 * server-side `dispatchTool` the Classic chat route uses — which keeps the
 * `web_search` Tavily key server-only — and return the result for the client to
 * hand back to the model via `session.sendToolResponse`.
 *
 * The allowlist mirrors the tool declarations in lib/conversation/tools.ts so a
 * forged request can't invoke anything unexpected.
 */
const ALLOWED_TOOLS = new Set(['get_weather', 'get_current_time', 'web_search']);

export async function POST(req: NextRequest) {
  let body: { name?: unknown; args?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; args?: unknown };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name : '';
  if (!ALLOWED_TOOLS.has(name)) {
    return jsonResponse({ error: `Unknown tool: ${name || '(none)'}` }, 400);
  }

  const args =
    body.args && typeof body.args === 'object'
      ? (body.args as Record<string, unknown>)
      : {};

  // dispatchTool never throws (it catches and returns { error }).
  const result = await dispatchTool(name, args);
  return jsonResponse(result, 200);
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
