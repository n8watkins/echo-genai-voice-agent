import { describe, it, expect } from 'vitest';
import { estimateCostUsd, hasPricing, MODEL_PRICING } from './devtrace';

describe('estimateCostUsd()', () => {
  it('computes cost via the §6 formula for a known model', () => {
    // gemini-3.1-flash-lite: $0.25/1M in, $1.50/1M out.
    // 1,000,000 in + 1,000,000 out => 0.25 + 1.50 = 1.75
    expect(estimateCostUsd('gemini-3.1-flash-lite', 1_000_000, 1_000_000)).toBeCloseTo(1.75, 10);
  });

  it('scales linearly with token counts', () => {
    // 1000 in, 500 out on gemini-2.5-flash ($0.30 in, $2.50 out per 1M):
    // 1000/1e6*0.30 + 500/1e6*2.50 = 0.0003 + 0.00125 = 0.00155
    expect(estimateCostUsd('gemini-2.5-flash', 1000, 500)).toBeCloseTo(0.00155, 10);
  });

  it('returns 0 for an unknown / audio model (no confirmed $ rate)', () => {
    expect(estimateCostUsd('gemini-3.1-flash-live-preview', 5000, 5000)).toBe(0);
    expect(estimateCostUsd('totally-made-up', 100, 100)).toBe(0);
  });

  it('treats zero tokens as zero cost', () => {
    expect(estimateCostUsd('gemini-3.1-flash-lite', 0, 0)).toBe(0);
  });

  it('clamps negative and non-finite token counts to 0', () => {
    expect(estimateCostUsd('gemini-3.1-flash-lite', -100, -50)).toBe(0);
    expect(estimateCostUsd('gemini-3.1-flash-lite', NaN, Infinity)).toBe(0);
  });

  it('counts only the out tokens when in is 0', () => {
    // gemini-2.5-flash-lite out rate $0.40/1M; 1M out => 0.40
    expect(estimateCostUsd('gemini-2.5-flash-lite', 0, 1_000_000)).toBeCloseTo(0.4, 10);
  });

  it('matches a hand-computed value across every priced model', () => {
    for (const [model, price] of Object.entries(MODEL_PRICING)) {
      const expected = (2000 / 1e6) * price.inPerM + (3000 / 1e6) * price.outPerM;
      expect(estimateCostUsd(model, 2000, 3000)).toBeCloseTo(expected, 12);
    }
  });
});

describe('hasPricing()', () => {
  it('is true for text models in the §6 table', () => {
    expect(hasPricing('gemini-3.1-flash-lite')).toBe(true);
    expect(hasPricing('gemini-3.5-flash')).toBe(true);
  });

  it('is false for unknown / audio models', () => {
    expect(hasPricing('gemini-3.1-flash-live-preview')).toBe(false);
    expect(hasPricing('nope')).toBe(false);
  });
});
