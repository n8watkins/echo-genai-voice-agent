import { NextRequest } from 'next/server';
import { type Content, type Part } from '@google/genai';
import { getClient, resolveApiKey, pickModel } from '@/lib/gemini';
import { SYSTEM_PROMPT } from '@/lib/conversation/prompts';
import { functionDeclarations, dispatchTool } from '@/lib/conversation/tools';
import { encodeSSE } from '@/lib/sse';
import { recordModelCall, demoPoolExhausted } from '@/app/api/usage/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

interface ChatBody {
  message: string;
  history?: ChatTurn[];
  apiKey?: string | null;
  /** Optional persona system prompt; falls back to the default SYSTEM_PROMPT. */
  systemPrompt?: string | null;
  /** Requested text/tool model id; server allowlists + BYOK-gates it. */
  model?: string | null;
}

const MAX_TOOL_ROUNDS = 4;

// Server-side input caps — never trust the client's trimming. A turn that
// exceeds these is rejected outright rather than silently truncated.
const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_TURNS = 24;
const MAX_HISTORY_TURN_CHARS = 4000;
const MAX_HISTORY_TOTAL_CHARS = 48000;

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body.message?.trim()) {
    return new Response('Empty message', { status: 400 });
  }

  if (body.message.length > MAX_MESSAGE_CHARS) {
    return new Response('Message too long', { status: 413 });
  }

  // Clamp history server-side: cap turn count, per-turn size, and total size.
  // Keep the most recent turns (closest to the new message).
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  let totalHistoryChars = 0;
  const history: ChatTurn[] = [];
  for (const turn of rawHistory.slice(-MAX_HISTORY_TURNS)) {
    if (turn?.role !== 'user' && turn?.role !== 'assistant') continue;
    const text = typeof turn.text === 'string' ? turn.text.slice(0, MAX_HISTORY_TURN_CHARS) : '';
    if (!text) continue;
    totalHistoryChars += text.length;
    if (totalHistoryChars > MAX_HISTORY_TOTAL_CHARS) {
      return new Response('History too large', { status: 413 });
    }
    history.push({ role: turn.role, text });
  }

  const resolved = resolveApiKey(body.apiKey);
  if (!resolved) {
    return new Response('No API key configured', { status: 503 });
  }

  // Enforce the shared demo budget (250 model calls / rolling 24h). BYOK
  // requests bypass entirely.
  if (resolved.source === 'demo' && demoPoolExhausted()) {
    return new Response(
      JSON.stringify({
        error: 'demo_pool_exhausted',
        message:
          "The shared demo budget for today is used up. Add your own free Gemini key to keep talking — it's unlimited and never draws from the pool.",
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // The caller supplied their own key iff resolution picked the BYOK source.
  // Only then may a non-shared model be honored; otherwise pickModel() falls
  // back to the shared default. The client string is never trusted directly.
  const byok = resolved.source === 'byok';
  const model = pickModel(body.model ?? undefined, byok);
  const ai = getClient(resolved.apiKey);

  // Use the persona's system prompt if provided, else the default. Cap its
  // length defensively so a client can't smuggle a huge prompt through.
  const systemInstruction =
    typeof body.systemPrompt === 'string' && body.systemPrompt.trim()
      ? body.systemPrompt.slice(0, 4000)
      : SYSTEM_PROMPT;

  // Build conversation contents from short (clamped) history + the new turn.
  const contents: Content[] = [];
  for (const turn of history) {
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.text }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: body.message }] });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      try {
        let round = 0;
        // The function-calling loop: stream tokens; if the model emits a
        // function call, the stream pauses, we run the tool, append the
        // result, and continue with another generateContentStream call.
        while (round < MAX_TOOL_ROUNDS) {
          round += 1;

          // Count the call BEFORE awaiting the stream so an error/abort mid-
          // stream still counts — the model was hit either way. One chat turn
          // can fire up to MAX_TOOL_ROUNDS of these against the demo key.
          recordModelCall(resolved.source);

          // Telemetry only: mark when this model call started so the dev panel
          // can show real latency. Does not affect the call itself.
          const modelStartedAt = Date.now();

          const result = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations }],
              temperature: 0.7,
            },
          });

          const pendingCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
          // Collect the model's parts verbatim from the stream so we preserve
          // Gemini 3's `thoughtSignature` on functionCall parts — without it,
          // sending the call back for the tool-result round is rejected (400).
          const modelParts: Part[] = [];
          // Telemetry only: token counts arrive on the stream's final chunk's
          // usageMetadata; we keep the latest seen so the dev panel can show
          // tokens + estimated $. Never read by the product logic.
          let tokensIn = 0;
          let tokensOut = 0;

          for await (const chunk of result) {
            const text = chunk.text;
            if (text) {
              send(encodeSSE({ type: 'token', text }));
            }
            const usage = chunk.usageMetadata;
            if (usage) {
              tokensIn = usage.promptTokenCount ?? tokensIn;
              tokensOut = usage.candidatesTokenCount ?? tokensOut;
            }
            const parts = chunk.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const part of parts) {
                modelParts.push(part);
                if (part.functionCall?.name) {
                  pendingCalls.push({
                    name: part.functionCall.name,
                    args: (part.functionCall.args as Record<string, unknown>) ?? {},
                  });
                }
              }
            }
          }

          // Telemetry frame for this model call (additive; ignored by product).
          send(
            encodeSSE({
              type: 'telemetry_model',
              model,
              phase: 'chat-turn',
              startedAt: modelStartedAt,
              endedAt: Date.now(),
              tokensIn,
              tokensOut,
            })
          );

          if (pendingCalls.length === 0) {
            // Plain answer, no tools — we're done.
            break;
          }

          // Record the model's turn (text + the calls it made).
          contents.push({ role: 'model', parts: modelParts });

          // Run every requested tool and append the responses.
          const responseParts: Part[] = [];
          for (const call of pendingCalls) {
            send(encodeSSE({ type: 'tool', name: call.name }));
            const toolStartedAt = Date.now();
            const output = await dispatchTool(call.name, call.args);
            responseParts.push({
              functionResponse: { name: call.name, response: output },
            });
            // Telemetry frame for this tool exec (additive; product ignores it).
            // dispatchTool never throws (it catches and returns { error }), so
            // we infer ok from the absence of an `error` key in the result.
            send(
              encodeSSE({
                type: 'telemetry_tool',
                name: call.name,
                args: call.args,
                ok: !(output && typeof output === 'object' && 'error' in output),
                startedAt: toolStartedAt,
                endedAt: Date.now(),
                rawResult: output,
              })
            );
          }
          contents.push({ role: 'user', parts: responseParts });
          // loop again — model continues with tool results
        }

        send(encodeSSE({ type: 'done' }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'The model request failed.';
        send(encodeSSE({ type: 'error', message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
