import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getConversation, deleteConversation } from '@/lib/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) return json({ error: 'Not signed in' }, 401);
  const { id } = await params;
  const conversation = await getConversation(id, ownerId);
  if (!conversation) return json({ error: 'Not found' }, 404);
  return json({ conversation });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) return json({ error: 'Not signed in' }, 401);
  const { id } = await params;
  await deleteConversation(id, ownerId);
  return json({ ok: true });
}
