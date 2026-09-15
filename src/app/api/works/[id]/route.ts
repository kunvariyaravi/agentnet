import { NextResponse } from 'next/server';
import { ensureSchema, queryOne, queryAll } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ensureSchema();

    // NOTE: all id comparisons cast both sides to ::text. Some installs have
    // TEXT id columns while others use UUID — without the casts Postgres
    // throws `operator does not exist: text = uuid` (500 with empty body).
    const work = await queryOne(`
      SELECT w.id, w.work_number, w.requester_id, w.agent_id, w.title, w.description,
        w.status, w.price, w.currency, w.payment_status, w.parent_work_id,
        w.created_at, w.started_at, w.completed_at, w.updated_at,
        a.name as agent_name, a.identity as agent_identity, a.avatar_url as agent_avatar,
        u.name as requester_name
      FROM works w
      LEFT JOIN agents a ON w.agent_id::text = a.id::text
      LEFT JOIN users u ON w.requester_id::text = u.id::text
      WHERE w.id::text = $1 OR w.work_number::text = $1
    `, [id]) as any;

    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    // Require authentication — only requester, agent owner, or admin can view
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isOwner = session.id === work.requester_id;
    const isAdmin = session.role === 'admin';

    // Check if user owns the agent
    const agentOwner = await queryOne('SELECT owner_id FROM agents WHERE id::text = $1', [work.agent_id]) as any;
    const isAgentOwner = agentOwner && session.id === agentOwner.owner_id;

    if (!isOwner && !isAdmin && !isAgentOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const events = await queryAll('SELECT id, work_id, status, message, created_at FROM work_events WHERE work_id::text = $1 ORDER BY created_at ASC', [work.id]);
    const inputs = await queryAll('SELECT id, work_id, file_name, file_url, file_type, file_size, created_at FROM work_inputs WHERE work_id::text = $1 ORDER BY created_at ASC', [work.id]);
    const outputs = await queryAll('SELECT id, work_id, file_name, file_url, file_type, file_size, artifact_type, created_at FROM work_outputs WHERE work_id::text = $1 ORDER BY created_at ASC', [work.id]);
    const rating = await queryOne('SELECT id, work_id, score, quality, reliability, speed, value, created_at FROM ratings WHERE work_id::text = $1', [work.id]);
    const review = await queryOne('SELECT id, work_id, title, content, created_at FROM reviews WHERE work_id::text = $1', [work.id]);

    // Get child works (delegations)
    const childWorks = await queryAll(`
      SELECT w.id, w.work_number, w.title, w.status, w.price, w.created_at,
        a.name as agent_name, a.identity as agent_identity
      FROM works w
      LEFT JOIN agents a ON w.agent_id::text = a.id::text
      WHERE w.parent_work_id::text = $1
      ORDER BY w.created_at ASC
    `, [work.id]);

    return NextResponse.json({ work, events, inputs, outputs, rating, review, childWorks });
  } catch (err: any) {
    console.error('GET /api/works/[id] failed:', err?.message || err);
    return NextResponse.json(
      { error: 'Failed to load work. The database is unreachable or slow — please retry.' },
      { status: 503 },
    );
  }
}
