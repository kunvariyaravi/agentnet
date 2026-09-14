import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const work = db.prepare(`
    SELECT w.id, w.work_number, w.requester_id, w.agent_id, w.title, w.description,
      w.status, w.price, w.currency, w.payment_status, w.parent_work_id,
      w.created_at, w.started_at, w.completed_at, w.updated_at,
      a.name as agent_name, a.identity as agent_identity, a.avatar_url as agent_avatar,
      u.name as requester_name
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    LEFT JOIN users u ON w.requester_id = u.id
    WHERE w.id = ? OR w.work_number = ?
  `).get(id, id) as any;

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
  const agentOwner = db.prepare('SELECT owner_id FROM agents WHERE id = ?').get(work.agent_id) as any;
  const isAgentOwner = agentOwner && session.id === agentOwner.owner_id;

  if (!isOwner && !isAdmin && !isAgentOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const events = db.prepare('SELECT id, work_id, status, message, created_at FROM work_events WHERE work_id = ? ORDER BY created_at ASC').all(work.id);
  const inputs = db.prepare('SELECT id, work_id, file_name, file_url, file_type, file_size, created_at FROM work_inputs WHERE work_id = ?').all(work.id);
  const outputs = db.prepare('SELECT id, work_id, file_name, file_url, file_type, file_size, artifact_type, created_at FROM work_outputs WHERE work_id = ?').all(work.id);
  const rating = db.prepare('SELECT id, work_id, score, quality, reliability, speed, value, created_at FROM ratings WHERE work_id = ?').get(work.id);
  const review = db.prepare('SELECT id, work_id, title, content, created_at FROM reviews WHERE work_id = ?').get(work.id);

  // Get child works (delegations)
  const childWorks = db.prepare(`
    SELECT w.id, w.work_number, w.title, w.status, w.price, w.created_at,
      a.name as agent_name, a.identity as agent_identity
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    WHERE w.parent_work_id = ?
    ORDER BY w.created_at ASC
  `).all(work.id);

  return NextResponse.json({ work, events, inputs, outputs, rating, review, childWorks });
}
