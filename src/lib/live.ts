/**
 * Shared constants + audio helpers for the native Live API voice engine.
 *
 * The Live API is PCM end-to-end (docs/UNDER_THE_HOOD.md §4d / §7 probe notes):
 *  - mic input: 16-bit signed PCM, mono, 16 kHz, sent as base64 in
 *    `sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } })`
 *  - model output: 16-bit signed PCM, mono, 24 kHz, arrives base64 on
 *    `serverContent.modelTurn.parts[].inlineData.data`.
 *
 * This module is engine-agnostic glue: model id, mime types, and the
 * float<->PCM16 + base64 conversions both sides of the socket need. It does
 * NOT touch the existing hand-built pipeline.
 */

/**
 * The Live voice model. Confirmed FREE on the current GEMINI_API_KEY and
 * confirmed to stream AUDIO back (flash-LIVE, distinct from flash-lite). §9.
 */
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';

/** Mic capture / playback sample rates the Live API expects. */
export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;

/** Mime type for the realtime PCM mic stream. */
export const INPUT_MIME_TYPE = `audio/pcm;rate=${INPUT_SAMPLE_RATE}`;

/** Default persona-less system instruction for the Live session. */
export const LIVE_SYSTEM_INSTRUCTION =
  'You are Echo, a warm, concise voice assistant. Keep replies short and conversational. ' +
  'You can call tools for the weather, the current time, and web search — use them when the ' +
  'user asks about current conditions, the time somewhere, or facts you are unsure of.';

/**
 * Encode a Float32 PCM frame ([-1,1]) to base64-encoded 16-bit little-endian
 * PCM — the on-the-wire format for `sendRealtimeInput`.
 */
export function float32ToBase64PCM16(input: Float32Array): string {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    // Clamp then scale to the signed 16-bit range.
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return arrayBufferToBase64(buffer);
}

/**
 * Decode base64 16-bit little-endian PCM (the model's audio output) into a
 * Float32Array suitable for an AudioBuffer channel.
 */
export function base64PCM16ToFloat32(base64: string): Float32Array {
  const bytes = base64ToUint8Array(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Downsample a Float32 frame from the AudioContext's native rate to 16 kHz
 * (nearest-neighbor decimation — cheap and adequate for speech). Returns the
 * input unchanged when already at the target rate.
 */
export function downsampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === INPUT_SAMPLE_RATE) return input;
  const ratio = fromRate / INPUT_SAMPLE_RATE;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    out[i] = input[Math.floor(i * ratio)];
  }
  return out;
}
