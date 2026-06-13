import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Optional transcript persistence. The plan marks SQLite as optional and
 * "fine to run ephemeral on free tier", so this keeps an in-memory ring of
 * recent transcripts rather than pulling in a native better-sqlite3 build.
 * The primary conversation log lives client-side; this endpoint exists so the
 * documented API surface is present and a future swap to SQLite is a drop-in.
 */

interface StoredTranscript {
  id: string;
  createdAt: string;
  turns: Array<{ role: 'user' | 'assistant'; text: string }>;
}

const MAX = 50;
const transcripts: StoredTranscript[] = [];

export async function GET() {
  return NextResponse.json({ conversations: transcripts.slice(-MAX) });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Pick<StoredTranscript, 'turns'>;
    const entry: StoredTranscript = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      turns: Array.isArray(body.turns) ? body.turns : [],
    };
    transcripts.push(entry);
    if (transcripts.length > MAX) transcripts.shift();
    return NextResponse.json({ ok: true, id: entry.id });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }
}
