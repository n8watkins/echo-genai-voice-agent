import { describe, it, expect } from 'vitest';
import { transition, type TurnState, type TurnEvent } from './turnMachine';

const HANDS_FREE = { handsFree: true };
const PTT = { handsFree: false };

describe('transition()', () => {
  it('walks the happy path idle -> listening -> thinking -> speaking', () => {
    let s: TurnState = 'idle';
    s = transition(s, { type: 'MIC_ON' }, PTT);
    expect(s).toBe('listening');
    s = transition(s, { type: 'FINAL_TRANSCRIPT' }, PTT);
    expect(s).toBe('thinking');
    s = transition(s, { type: 'FIRST_SENTENCE' }, PTT);
    expect(s).toBe('speaking');
  });

  describe('SPEECH_END depends on mode', () => {
    it('loops speaking -> listening in hands-free', () => {
      expect(transition('speaking', { type: 'SPEECH_END' }, HANDS_FREE)).toBe('listening');
    });
    it('returns speaking -> idle in push-to-talk', () => {
      expect(transition('speaking', { type: 'SPEECH_END' }, PTT)).toBe('idle');
    });
    it('falls back from thinking to listening/idle when nothing speakable', () => {
      expect(transition('thinking', { type: 'SPEECH_END' }, HANDS_FREE)).toBe('listening');
      expect(transition('thinking', { type: 'SPEECH_END' }, PTT)).toBe('idle');
    });
  });

  describe('barge-in', () => {
    it('speaking + BARGE_IN -> listening', () => {
      expect(transition('speaking', { type: 'BARGE_IN' }, HANDS_FREE)).toBe('listening');
      expect(transition('speaking', { type: 'BARGE_IN' }, PTT)).toBe('listening');
    });
    it('BARGE_IN is a no-op outside speaking', () => {
      expect(transition('idle', { type: 'BARGE_IN' }, PTT)).toBe('idle');
      expect(transition('listening', { type: 'BARGE_IN' }, PTT)).toBe('listening');
      expect(transition('thinking', { type: 'BARGE_IN' }, PTT)).toBe('thinking');
    });
  });

  describe('global edges', () => {
    const states: TurnState[] = ['idle', 'listening', 'thinking', 'speaking'];
    it('MIC_OFF goes to idle from any state', () => {
      for (const s of states) {
        expect(transition(s, { type: 'MIC_OFF' }, HANDS_FREE)).toBe('idle');
        expect(transition(s, { type: 'MIC_OFF' }, PTT)).toBe('idle');
      }
    });
    it('ERROR goes to idle from any state', () => {
      for (const s of states) {
        expect(transition(s, { type: 'ERROR' }, HANDS_FREE)).toBe('idle');
      }
    });
  });

  describe('no-op pairs (out-of-order async callbacks)', () => {
    const cases: Array<[TurnState, TurnEvent]> = [
      ['idle', { type: 'FINAL_TRANSCRIPT' }],
      ['idle', { type: 'FIRST_SENTENCE' }],
      ['idle', { type: 'SPEECH_END' }],
      ['listening', { type: 'MIC_ON' }],
      ['listening', { type: 'FIRST_SENTENCE' }],
      ['listening', { type: 'SPEECH_END' }],
      ['thinking', { type: 'MIC_ON' }],
      ['thinking', { type: 'FINAL_TRANSCRIPT' }],
      ['speaking', { type: 'MIC_ON' }],
      ['speaking', { type: 'FINAL_TRANSCRIPT' }],
      ['speaking', { type: 'FIRST_SENTENCE' }],
    ];
    it.each(cases)('%s + %o is a no-op', (state, event) => {
      expect(transition(state, event, HANDS_FREE)).toBe(state);
    });
  });
});
