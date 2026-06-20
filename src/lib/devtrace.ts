/**
 * Shared telemetry model for the "Under the Hood" dev panel.
 *
 * Purely observational: a turn of Echo's pipeline emits a list of TraceEvents
 * (model calls, tool execs, pipeline stages, turn-machine state transitions)
 * that the DevPanel renders as a latency waterfall + token/cost readout. None
 * of this changes the voice pipeline's behavior — events are recorded
 * alongside the existing logic.
 *
 * Design spec lives in docs/UNDER_THE_HOOD.md (§3 schema, §6 pricing). Echo
 * only emits text-model calls; the $ estimate applies only to
 * the models in the pricing table below.
 */

export type TraceEvent =
  | {
      kind: 'model_call';
      id: string;
      /** e.g. 'chat-turn' — Echo's text model phase. */
      phase: string;
      model: string;
      startedAt: number;
      endedAt: number;
      tokensIn: number;
      tokensOut: number;
      /** Estimated $ via the §6 pricing table (text models only). */
      costUsd: number;
      /** Gated behind a "show raw" accordion in the panel. */
      prompt?: string;
      rawResponse?: string;
      toolCall?: { name: string; args: unknown } | null;
    }
  | {
      kind: 'tool_exec';
      id: string;
      name: string;
      args: unknown;
      startedAt: number;
      endedAt: number;
      ok: boolean;
      /** Raw provider result, pre-summarization (accordion). */
      rawResult?: unknown;
    }
  | {
      kind: 'stage';
      id: string;
      /** e.g. 'stt' | 'model-first-token' | 'model-complete' | 'tts-sentence-1' | 'turn-total'. */
      label: string;
      startedAt: number;
      endedAt: number;
    }
  | {
      kind: 'state';
      machine: 'turn' | 'react';
      from: string;
      to: string;
      at: number;
    };

/**
 * Per-1M-token paid rates (docs/UNDER_THE_HOOD.md §6, verified 2026-06-14).
 * Used only for the illustrative "what this would cost at scale" readout — the
 * live demo runs on the free tier. Live/audio models are intentionally absent:
 * audio-token pricing is unconfirmed, so those modes show tokens + TPM
 * headroom, not a $ figure (§9).
 */
export const MODEL_PRICING: Record<string, { inPerM: number; outPerM: number }> = {
  'gemini-3.1-flash-lite': { inPerM: 0.25, outPerM: 1.5 },
  'gemini-2.5-flash-lite': { inPerM: 0.1, outPerM: 0.4 },
  'gemini-2.5-flash': { inPerM: 0.3, outPerM: 2.5 },
  'gemini-3-flash-preview': { inPerM: 0.5, outPerM: 3.0 },
  'gemini-3.5-flash': { inPerM: 1.5, outPerM: 9.0 },
};

/**
 * Estimate the USD cost of a single text-model call from its token counts.
 *
 * Returns 0 for unknown models (e.g. Live/audio models, which have no
 * confirmed $ rate) and clamps negative token counts to 0 defensively. The
 * formula is the §6 standard: tokens/1e6 * rate, summed over in + out.
 */
export function estimateCostUsd(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const price = MODEL_PRICING[model];
  if (!price) return 0;
  const safeIn = Number.isFinite(tokensIn) && tokensIn > 0 ? tokensIn : 0;
  const safeOut = Number.isFinite(tokensOut) && tokensOut > 0 ? tokensOut : 0;
  return (safeIn / 1e6) * price.inPerM + (safeOut / 1e6) * price.outPerM;
}

/** True when we have a $ rate for this model (text models in the §6 table). */
export function hasPricing(model: string): boolean {
  return model in MODEL_PRICING;
}
