/**
 * Tiny Server-Sent-Events helpers shared by the /api/chat route (encode) and
 * the client orchestrator (decode). We only need one-way (server → client)
 * streaming for the model tokens — an honest contrast to the WebSocket
 * transport used elsewhere in the portfolio.
 */

export type SSEEvent =
  | { type: 'token'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
  // ---- Telemetry frames (additive; consumed only by the dev panel) --------
  // These piggyback on the existing stream so the "Under the Hood" panel can
  // show real model/tool metrics. The product client ignores them; they never
  // affect token text, tool dispatch, or the done/error contract above.
  | {
      type: 'telemetry_model';
      model: string;
      phase: string;
      startedAt: number;
      endedAt: number;
      tokensIn: number;
      tokensOut: number;
    }
  | {
      type: 'telemetry_tool';
      name: string;
      args: unknown;
      ok: boolean;
      startedAt: number;
      endedAt: number;
      rawResult?: unknown;
    };

/** Encode one event as an SSE `data:` frame. */
export function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Parse a streamed chunk of SSE text into events. Maintains a rolling buffer
 * across calls via the returned `rest` so partial frames are not lost.
 */
export function decodeSSE(buffer: string): { events: SSEEvent[]; rest: string } {
  const events: SSEEvent[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    const json = line.slice('data:'.length).trim();
    if (!json) continue;
    try {
      events.push(JSON.parse(json) as SSEEvent);
    } catch {
      // ignore malformed frame
    }
  }
  return { events, rest };
}
