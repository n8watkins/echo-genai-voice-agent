import { getDb } from './db';

/**
 * Conversation persistence (Turso). All access is scoped by `anonId` — the
 * per-browser anonymous id that owns a conversation. Reads/deletes require the
 * matching anonId; saves can't hijack another browser's conversation id.
 *
 * Every function no-ops (returns empty / false) when persistence is off, so
 * callers never need to branch on configuration.
 */

export interface StoredTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ConversationSummary {
  id: string;
  engine: string;
  persona: string | null;
  title: string;
  updatedAt: number;
}

export interface StoredConversation extends ConversationSummary {
  createdAt: number;
  turns: StoredTurn[];
}

const MAX_LIST = 50;
const MAX_TURNS = 200;
const MAX_TURN_CHARS = 4000;
const MAX_TITLE_CHARS = 80;

export async function listConversations(anonId: string): Promise<ConversationSummary[]> {
  const db = await getDb();
  if (!db || !anonId) return [];
  const rs = await db.execute({
    sql: `SELECT id, engine, persona, title, updated_at
          FROM conversations WHERE anon_id = ? ORDER BY updated_at DESC LIMIT ?`,
    args: [anonId, MAX_LIST],
  });
  return rs.rows.map((r) => ({
    id: String(r.id),
    engine: String(r.engine),
    persona: r.persona == null ? null : String(r.persona),
    title: String(r.title ?? ''),
    updatedAt: Number(r.updated_at),
  }));
}

export async function getConversation(
  id: string,
  anonId: string
): Promise<StoredConversation | null> {
  const db = await getDb();
  if (!db || !id || !anonId) return null;
  const head = await db.execute({
    sql: `SELECT id, engine, persona, title, created_at, updated_at
          FROM conversations WHERE id = ? AND anon_id = ?`,
    args: [id, anonId],
  });
  const c = head.rows[0];
  if (!c) return null;
  const msgs = await db.execute({
    sql: `SELECT role, text FROM messages WHERE conversation_id = ? ORDER BY idx ASC`,
    args: [id],
  });
  return {
    id: String(c.id),
    engine: String(c.engine),
    persona: c.persona == null ? null : String(c.persona),
    title: String(c.title ?? ''),
    createdAt: Number(c.created_at),
    updatedAt: Number(c.updated_at),
    turns: msgs.rows.map((m) => ({
      role: String(m.role) === 'assistant' ? 'assistant' : 'user',
      text: String(m.text),
    })),
  };
}

export interface SaveConversationInput {
  id: string;
  anonId: string;
  engine: string;
  persona?: string | null;
  turns: StoredTurn[];
  now: number;
}

export async function saveConversation(input: SaveConversationInput): Promise<boolean> {
  const db = await getDb();
  if (!db || !input.id || !input.anonId) return false;

  const turns = input.turns
    .filter((t) => t && typeof t.text === 'string' && t.text.trim())
    .slice(0, MAX_TURNS)
    .map((t) => ({
      role: t.role === 'assistant' ? 'assistant' : 'user',
      text: t.text.slice(0, MAX_TURN_CHARS),
    }));
  if (turns.length === 0) return false;

  const title = (turns.find((t) => t.role === 'user')?.text || 'Conversation').slice(0, MAX_TITLE_CHARS);

  await db.batch(
    [
      {
        // Insert, or update only if THIS anon owns the row (can't hijack an id).
        sql: `INSERT INTO conversations (id, anon_id, engine, persona, title, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                title = excluded.title, updated_at = excluded.updated_at,
                engine = excluded.engine, persona = excluded.persona
              WHERE conversations.anon_id = excluded.anon_id`,
        args: [input.id, input.anonId, input.engine, input.persona ?? null, title, input.now, input.now],
      },
      { sql: `DELETE FROM messages WHERE conversation_id = ?`, args: [input.id] },
      ...turns.map((t, i) => ({
        sql: `INSERT INTO messages (id, conversation_id, role, text, idx) VALUES (?, ?, ?, ?, ?)`,
        args: [`${input.id}:${i}`, input.id, t.role, t.text, i],
      })),
    ],
    'write'
  );
  return true;
}

export async function deleteConversation(id: string, anonId: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !id || !anonId) return false;
  // Delete messages only when the conversation is owned by this anon.
  await db.batch(
    [
      {
        sql: `DELETE FROM messages WHERE conversation_id IN
                (SELECT id FROM conversations WHERE id = ? AND anon_id = ?)`,
        args: [id, anonId],
      },
      { sql: `DELETE FROM conversations WHERE id = ? AND anon_id = ?`, args: [id, anonId] },
    ],
    'write'
  );
  return true;
}
