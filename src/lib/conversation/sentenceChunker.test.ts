import { describe, it, expect } from 'vitest';
import { SentenceChunker, clean } from './sentenceChunker';

describe('clean()', () => {
  it('strips bold/italic/strikethrough markers', () => {
    expect(clean('**hello** _world_ ~~gone~~')).toBe('hello world gone');
  });

  it('unwraps inline code and markdown links', () => {
    expect(clean('use `npm test` see [the docs](https://x.io)')).toBe(
      'use npm test see the docs'
    );
  });

  it('removes code fences', () => {
    expect(clean('before ```js\nconst x = 1;\n``` after')).toBe('before after');
  });

  it('strips heading and list markers at line starts', () => {
    expect(clean('## Title')).toBe('Title');
    expect(clean('- item one')).toBe('item one');
    expect(clean('• bullet')).toBe('bullet');
  });

  it('removes emoji and collapses whitespace', () => {
    expect(clean('hi 😀   there 🚀')).toBe('hi there');
  });

  it('trims and returns empty for whitespace-only input', () => {
    expect(clean('   \n  ')).toBe('');
  });
});

describe('SentenceChunker', () => {
  it('flushes a complete sentence as soon as a boundary arrives', () => {
    const c = new SentenceChunker();
    expect(c.push('Hello there')).toEqual([]);
    expect(c.push('. How are you')).toEqual(['Hello there.']);
    // The remaining punctuation-less fragment is force-flushed; words are kept.
    expect(c.flush().join(' ')).toBe('How are you');
  });

  it('handles multiple sentences in one push', () => {
    const c = new SentenceChunker();
    expect(c.push('One. Two! Three? ')).toEqual(['One.', 'Two!', 'Three?']);
  });

  it('treats a newline followed by whitespace as a boundary', () => {
    const c = new SentenceChunker();
    // A boundary requires the terminator to be followed by whitespace/end; the
    // first newline is followed by a space and the second by end-of-buffer, so
    // both flush from a single push.
    expect(c.push('Line one\n Line two\n')).toEqual(['Line one', 'Line two']);
  });

  it('keeps a half-finished sentence buffered until it completes', () => {
    const c = new SentenceChunker();
    expect(c.push('The weather is')).toEqual([]);
    // Simulates the mid-stream tool-call gap: more tokens arrive later.
    expect(c.push(' sunny.')).toEqual(['The weather is sunny.']);
  });

  it('flush() emits a single-word trailing fragment with no terminal punctuation', () => {
    const c = new SentenceChunker();
    c.push('Hello');
    expect(c.flush()).toEqual(['Hello']);
  });

  it('flush() force-splits a multi-word fragment at the last space, losing nothing', () => {
    const c = new SentenceChunker();
    c.push('No period here');
    // The safety valve cuts at the final space; concatenated, the words are all
    // present and in order so no audio is dropped.
    const out = c.flush();
    expect(out.join(' ')).toBe('No period here');
  });

  it('flush() on an empty buffer returns nothing', () => {
    const c = new SentenceChunker();
    expect(c.flush()).toEqual([]);
  });

  it('reset() discards buffered text (barge-in)', () => {
    const c = new SentenceChunker();
    c.push('partial sentence');
    c.reset();
    expect(c.flush()).toEqual([]);
  });

  it('cleans markdown out of flushed chunks', () => {
    const c = new SentenceChunker();
    expect(c.push('Use **bold** now. ')).toEqual(['Use bold now.']);
  });

  it('force-flushes an over-long clause with no punctuation', () => {
    const c = new SentenceChunker();
    const long = 'word '.repeat(60); // ~300 chars, no sentence boundary
    const out = c.push(long);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].length).toBeLessThanOrEqual(220);
  });
});
