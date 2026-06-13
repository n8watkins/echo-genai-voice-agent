/**
 * Speak-as-you-stream sentence chunker.
 *
 * The single biggest perceived-latency win: instead of waiting for the whole
 * model reply, we buffer streamed tokens and flush a *speakable* chunk as soon
 * as we hit sentence-ending punctuation (or a max length). The TTS queue can
 * then start talking on sentence one.
 *
 * It also strips markdown/emoji that a synthesizer would otherwise read
 * literally, and — crucially per the plan's §12a — it tolerates the mid-stream
 * pause caused by a tool call: `push()` simply keeps buffering across the gap,
 * and a half-finished sentence is never flushed until it actually completes or
 * `flush()` is called at the very end.
 */

const MAX_CHUNK_LENGTH = 220; // hard cap so a runaway clause still gets spoken

export class SentenceChunker {
  private buffer = '';

  /**
   * Feed a streamed token (or arbitrary text fragment). Returns zero or more
   * complete sentences ready to be spoken, in order.
   */
  push(token: string): string[] {
    this.buffer += token;
    return this.drain(false);
  }

  /**
   * Flush whatever remains as a final chunk (call when the stream ends).
   */
  flush(): string[] {
    const out = this.drain(true);
    const leftover = clean(this.buffer);
    this.buffer = '';
    if (leftover) out.push(leftover);
    return out;
  }

  /** Discard any buffered text (e.g. on barge-in). */
  reset(): void {
    this.buffer = '';
  }

  private drain(force: boolean): string[] {
    const chunks: string[] = [];

    // Emit every complete sentence currently in the buffer.
    // A sentence boundary is . ! ? or a newline, optionally followed by
    // closing quotes/brackets, then whitespace or end-of-buffer.
    const boundary = /[.!?\n]+["')\]]?(\s|$)/;
    let match: RegExpMatchArray | null;
    while ((match = this.buffer.match(boundary)) !== null) {
      const end = (match.index ?? 0) + match[0].length;
      const sentence = clean(this.buffer.slice(0, end));
      this.buffer = this.buffer.slice(end);
      if (sentence) chunks.push(sentence);
    }

    // Safety valve: if a single clause grows past the cap with no punctuation,
    // flush it at the last space so audio doesn't stall.
    while (this.buffer.length > MAX_CHUNK_LENGTH || (force && this.buffer.length > 0 && chunks.length === 0)) {
      const cut = lastSpaceBefore(this.buffer, MAX_CHUNK_LENGTH) ?? this.buffer.length;
      const part = clean(this.buffer.slice(0, cut));
      this.buffer = this.buffer.slice(cut);
      if (part) chunks.push(part);
      if (!force && this.buffer.length <= MAX_CHUNK_LENGTH) break;
      if (force) break;
    }

    return chunks;
  }
}

function lastSpaceBefore(s: string, max: number): number | null {
  const slice = s.slice(0, max);
  const idx = slice.lastIndexOf(' ');
  return idx > 0 ? idx + 1 : null;
}

/**
 * Strip markdown/emoji and collapse whitespace so the synthesizer reads clean
 * prose. Exported for unit-testing.
 */
export function clean(text: string): string {
  return (
    text
      // code fences / inline code
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      // bold/italic/strikethrough markers
      .replace(/[*_~]{1,3}/g, '')
      // markdown links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // headings / list bullets at line starts
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*[-•]\s+/gm, '')
      // emoji & pictographs
      .replace(
        /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim()
  );
}
