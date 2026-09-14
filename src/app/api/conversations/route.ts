import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getConversations, getConversationMessages } from '@/lib/features';

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('id');

  if (conversationId) {
    const messages = getConversationMessages(conversationId);
    return NextResponse.json({ messages });
  }

  const conversations = getConversations(user.id);
  return NextResponse.json({ conversations });
}
