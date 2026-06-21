import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { isDbConfigured } from '@/lib/db';
import { listConversations, saveConversation, type StoredTurn } from '@/lib/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Conversation persistence, scoped to the signed-in GitHub user. The owner id
 * comes from the Auth.js session (never the client), so a browser can only read
 * and write its own user's conversations. No session -> no persistence.
 */

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!isDbConfigured() || !ownerId) {
    return json({ conversations: [], persistence: isDbConfigured(), signedIn: Boolean(ownerId) });
  }
  const conversations = await listConversations(ownerId);
  return json({ conversations, persistence: true, signedIn: true });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) return json({ ok: false, error: 'Not signed in' }, 401);
  if (!isDbConfigured()) return json({ ok: false, error: 'Persistence not configured' }, 200);

  let body: { id?: unknown; engine?: unknown; persona?: unknown; turns?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const engine = body.engine === 'live' ? 'live' : 'classic';
  const persona = typeof body.persona === 'string' ? body.persona : null;
  const turns: StoredTurn[] = Array.isArray(body.turns)
    ? body.turns
        .filter(
          (t): t is StoredTurn =>
            !!t && typeof (t as StoredTurn).text === 'string'
        )
        .map((t) => ({ role: t.role === 'assistant' ? 'assistant' : 'user', text: t.text }))
    : [];

  if (!id || turns.length === 0) return json({ ok: false, error: 'Missing id or turns' }, 400);

  const ok = await saveConversation({ id, ownerId, engine, persona, turns, now: Date.now() });
  return json({ ok });
}
