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

export function resolveModel(): string {
  return process.env.ECHO_MODEL?.trim() || DEFAULT_MODEL;
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

export function getClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}
