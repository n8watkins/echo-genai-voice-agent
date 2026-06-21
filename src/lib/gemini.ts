import { GoogleGenAI } from '@google/genai';

/**
 * Model client + key resolution.
 *
 * BYOK/demo pattern (mirrors the rest of the portfolio): the request may carry
 * a user-supplied key (passed from the browser, stored only in localStorage on
 * the client) which takes priority; otherwise we fall back to the server demo
 * key in GEMINI_API_KEY. Keys are never logged.
 */

export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

/**
 * The one model that may run on the SHARED demo key. It has the highest free-
 * tier quota (500 req/day) and the lowest latency (which matters for the voice
 * loop). Every other model is BYOK-only — visitors must paste their own key.
 */
export const SHARED_MODEL = 'gemini-3.1-flash-lite';

export type ModelTier = 'shared' | 'byok';

export interface ModelOption {
  id: string;
  label: string;
  tier: ModelTier;
  blurb: string;
}

/**
 * The text / tool-calling model menu (NOT the voice/STT/TTS stack). All of
 * these support function calling, so Echo's weather/time/web_search tools keep
 * working regardless of choice. Shared-first; everything else gates on BYOK.
 */
export const MODELS: ModelOption[] = [
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    tier: 'shared',
    blurb: 'Fastest & free on the shared key — the default.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    tier: 'byok',
    blurb: 'Lightweight 2.5-series model.',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    tier: 'byok',
    blurb: 'Balanced 2.5-series workhorse.',
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash (preview)',
    tier: 'byok',
    blurb: 'Preview of the 3-series Flash model.',
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    tier: 'byok',
    blurb: 'Most capable Flash model.',
  },
];

export function resolveModel(): string {
  return process.env.ECHO_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Server-side allowlist + BYOK gate. NEVER trust the client's model string.
 * Returns `requested` only when it is a known model AND it is allowed for the
 * caller: shared-tier models are always allowed; byok-tier models require the
 * caller to have supplied their own key (`byok === true`). Anything else falls
 * back to the env default / SHARED_MODEL via resolveModel().
 */
export function pickModel(requested: string | undefined, byok: boolean): string {
  const match = requested ? MODELS.find((m) => m.id === requested) : undefined;
  if (match && (match.tier === 'shared' || byok)) {
    return match.id;
  }
  return resolveModel();
}

export interface ResolvedKey {
  apiKey: string;
  source: 'byok' | 'demo';
}

export function resolveApiKey(userKey?: string | null): ResolvedKey | null {
  const trimmed = userKey?.trim();
  if (trimmed) return { apiKey: trimmed, source: 'byok' };
  const demo = process.env.GEMINI_API_KEY?.trim();
  if (demo) return { apiKey: demo, source: 'demo' };
  return null;
}

/**
 * Build a GoogleGenAI client. Pass `apiVersion: 'v1alpha'` for the Live API /
 * ephemeral-token surface (`ai.live`, `ai.authTokens`), which is NOT exposed on
 * the default `v1beta` endpoint — calling `authTokens.create` on v1beta returns
 * a bare `404 Not Found`. Text/tool calls stay on the default (v1beta).
 */
export function getClient(apiKey: string, apiVersion?: string): GoogleGenAI {
  return new GoogleGenAI(apiVersion ? { apiKey, apiVersion } : { apiKey });
}
