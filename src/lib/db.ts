import { createClient, type Client } from '@libsql/client';

/**
 * Turso (libSQL) client for persistent conversation storage.
 *
 * Optional, like every other key in this project: if TURSO_DATABASE_URL +
 * TURSO_AUTH_TOKEN aren't set, persistence is simply OFF and Echo runs exactly
 * as before (in-memory transcripts, nothing stored). The auth token stays
 * server-side — only the API routes touch this module.
 *
 * Privacy posture: storage is anonymous and text-only. A per-browser anon id
 * scopes "your" conversations; we persist transcripts (what was said), never
 * audio.
 */

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

function getClient(): Client | null {
  if (!isDbConfigured()) return null;
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  }
  return client;
}

async function ensureSchema(c: Client): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await c.batch(
        [
          `CREATE TABLE IF NOT EXISTS conversations (
             id TEXT PRIMARY KEY,
             anon_id TEXT NOT NULL,
             engine TEXT NOT NULL,
             persona TEXT,
             title TEXT,
             created_at INTEGER NOT NULL,
             updated_at INTEGER NOT NULL
           )`,
          `CREATE INDEX IF NOT EXISTS idx_conversations_anon
             ON conversations (anon_id, updated_at DESC)`,
          `CREATE TABLE IF NOT EXISTS messages (
             id TEXT PRIMARY KEY,
             conversation_id TEXT NOT NULL,
             role TEXT NOT NULL,
             text TEXT NOT NULL,
             idx INTEGER NOT NULL
           )`,
          `CREATE INDEX IF NOT EXISTS idx_messages_conv
             ON messages (conversation_id, idx)`,
        ],
        'write'
      );
    })().catch((err) => {
      // Reset so a transient failure can retry on the next request.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/** A ready client (schema ensured) or null when persistence is off. */
export async function getDb(): Promise<Client | null> {
  const c = getClient();
  if (!c) return null;
  await ensureSchema(c);
  return c;
}
