import { NextResponse } from 'next/server';
import { getAgentAnalytics } from '@/lib/features';
import { getSession } from '@/lib/auth';
import { ensureSchema, queryOne } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await ensureSchema();

    // Verify the user owns this agent or is admin
    const agent = await queryOne('SELECT owner_id FROM agents WHERE id = $1', [id]) as any;
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (session.id !== agent.owner_id && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const analytics = getAgentAnalytics(id);
    return NextResponse.json(analytics);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
