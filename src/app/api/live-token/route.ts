import { NextRequest } from 'next/server';
import { Modality } from '@google/genai';
import { getClient, resolveApiKey } from '@/lib/gemini';
import { LIVE_MODEL, LIVE_SYSTEM_INSTRUCTION } from '@/lib/live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ephemeral-token mint for the native Live API voice engine (Mode B).
 *
 * The browser connects DIRECTLY to Gemini over WebSocket for lowest latency
 * (docs/UNDER_THE_HOOD.md §4d), so it needs a credential — but the raw demo
 * key must NEVER ship to the client. Instead this server route mints a
 * short-lived, single-use ephemeral token (`ai.authTokens.create`) scoped to
 * the Live model + AUDIO modality, and returns only the token NAME. The token
 * is the apiKey the client passes to `ai.live.connect`.
 *
 * v1 scope: demo/shared key only. The Live model is FREE on the current key
 * (TPM-capped, §7); BYOK-for-live is a later concern. We still reuse the
 * resolveApiKey/getClient seam so a future BYOK path drops in cleanly.
 */

interface LiveTokenBody {
  /** Optional persona system prompt, locked into the token's Live config. */
  systemPrompt?: string | null;
}

export async function POST(req: NextRequest) {
  let body: LiveTokenBody = {};
  try {
    body = (await req.json()) as LiveTokenBody;
  } catch {
    // Empty body is fine — system prompt is optional.
  }

  // v1: only the server demo key mints Live tokens. (Pass no user key so we
  // don't accidentally mint a token against someone's BYOK key for now.)
  const resolved = resolveApiKey(null);
  if (!resolved) {
    return new Response(
      JSON.stringify({ error: 'No API key configured for Live mode.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const systemInstruction =
    typeof body.systemPrompt === 'string' && body.systemPrompt.trim()
      ? body.systemPrompt.slice(0, 4000)
      : LIVE_SYSTEM_INSTRUCTION;

  // Ephemeral tokens (ai.authTokens) live on the v1alpha API surface only;
  // a default (v1beta) client returns 404 Not Found from authTokens.create.
  const ai = getClient(resolved.apiKey, 'v1alpha');

  try {
    // Single-use token, default ~30-min TTL, locked to the Live model + AUDIO.
    // The client may still open exactly one session with it.
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            // NOTE: native Google Search grounding (tools:[{googleSearch:{}}]) was
            // tried here but the Live socket closes with 1011 "quota/billing" on the
            // free key — grounding needs a paid tier. Live search would instead need
            // Tavily via custom function calling (see HANDOFF). Left tool-less for now.
          },
        },
      },
    });

    if (!token?.name) {
      return new Response(
        JSON.stringify({ error: 'Token mint returned no name.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return ONLY the token name + the model id the client should connect with.
    // The raw GEMINI_API_KEY never leaves the server.
    return new Response(JSON.stringify({ token: token.name, model: LIVE_MODEL }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to mint a Live token.';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
