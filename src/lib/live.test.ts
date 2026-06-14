import { describe, it, expect } from 'vitest';
import {
  float32ToBase64PCM16,
  base64PCM16ToFloat32,
  downsampleTo16k,
  INPUT_SAMPLE_RATE,
} from './live';

describe('live audio PCM helpers', () => {
  it('round-trips a float frame through base64 PCM16 within quantization error', () => {
    const input = new Float32Array([0, 0.5, -0.5, 1, -1, 0.25]);
    const b64 = float32ToBase64PCM16(input);
    const out = base64PCM16ToFloat32(b64);
    expect(out.length).toBe(input.length);
    for (let i = 0; i < input.length; i++) {
      // 16-bit quantization step is ~1/32768; allow a small tolerance.
      expect(Math.abs(out[i] - input[i])).toBeLessThan(2e-4);
    }
  });

  it('clamps out-of-range samples to [-1, 1]', () => {
    const input = new Float32Array([2, -2]);
    const out = base64PCM16ToFloat32(float32ToBase64PCM16(input));
    expect(out[0]).toBeLessThanOrEqual(1);
    expect(out[1]).toBeGreaterThanOrEqual(-1);
  });

  it('returns the input unchanged when already at 16kHz', () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    expect(downsampleTo16k(input, INPUT_SAMPLE_RATE)).toBe(input);
  });

  it('decimates a 48kHz frame to ~1/3 the samples', () => {
    const input = new Float32Array(48);
    for (let i = 0; i < input.length; i++) input[i] = i / 48;
    const out = downsampleTo16k(input, 48000);
    expect(out.length).toBe(16);
    // Nearest-neighbor: first sample preserved.
    expect(out[0]).toBe(input[0]);
  });

  it('produces empty output for an empty base64 input', () => {
    expect(base64PCM16ToFloat32('').length).toBe(0);
  });
});
