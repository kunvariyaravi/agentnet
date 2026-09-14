import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getConversations, getConversationMessages } from '@/lib/features';
import { ensureSchema, queryOne } from '@/lib/db';

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('id');

  if (conversationId) {
    await ensureSchema();
    const conv = await queryOne('SELECT id FROM conversations WHERE id = $1 AND user_id = $2', [conversationId, user.id]);
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    const messages = getConversationMessages(conversationId);
    return NextResponse.json({ messages });
  }

  const conversations = getConversations(user.id);
  return NextResponse.json({ conversations });
}
