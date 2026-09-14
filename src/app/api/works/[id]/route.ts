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
    SELECT w.*, a.name as agent_name, a.identity as agent_identity, a.avatar_url as agent_avatar,
      u.name as requester_name
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    LEFT JOIN users u ON w.requester_id = u.id
    WHERE w.id = ? OR w.work_number = ?
  `).get(id, id) as any;

  if (!work) {
    return NextResponse.json({ error: 'Work not found' }, { status: 404 });
  }

  const events = db.prepare('SELECT * FROM work_events WHERE work_id = ? ORDER BY created_at ASC').all(work.id);
  const inputs = db.prepare('SELECT * FROM work_inputs WHERE work_id = ?').all(work.id);
  const outputs = db.prepare('SELECT * FROM work_outputs WHERE work_id = ?').all(work.id);
  const rating = db.prepare('SELECT * FROM ratings WHERE work_id = ?').get(work.id);
  const review = db.prepare('SELECT * FROM reviews WHERE work_id = ?').get(work.id);

  // Get child works (delegations)
  const childWorks = db.prepare(`
    SELECT w.*, a.name as agent_name, a.identity as agent_identity
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    WHERE w.parent_work_id = ?
    ORDER BY w.created_at ASC
  `).all(work.id);

  return NextResponse.json({ work, events, inputs, outputs, rating, review, childWorks });
}
