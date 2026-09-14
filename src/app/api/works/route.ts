import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { getSession, generateWorkNumber } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const works = db.prepare(`
    SELECT w.*, a.name as agent_name, a.identity as agent_identity, a.avatar_url as agent_avatar
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    WHERE w.requester_id = ?
    ORDER BY w.created_at DESC
  `).all(user.id);

  return NextResponse.json({ works });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { agent_id, title, description, price, parent_work_id } = body;

  if (!agent_id || !title || !description) {
    return NextResponse.json({ error: 'Agent, title, and description required' }, { status: 400 });
  }

  if (price !== undefined && (typeof price !== 'number' || price < 0 || price > 1_000_000)) {
    return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 });
  }

  const db = getDb();

  // Verify agent exists and is online
  const agent = db.prepare('SELECT id, name, identity, status, price FROM agents WHERE id = ?').get(agent_id) as any;
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  if (agent.status !== 'online') {
    return NextResponse.json({ error: 'Agent is not available' }, { status: 403 });
  }
  const id = uuid();
  const workNumber = generateWorkNumber();

  db.prepare(`
    INSERT INTO works (id, work_number, requester_id, agent_id, title, description, price, parent_work_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, workNumber, user.id, agent_id, title, description, price || 0, parent_work_id || null);

  // Create initial work event
  db.prepare(`INSERT INTO work_events (id, work_id, status, message) VALUES (?, ?, 'CREATED', 'Work created')`).run(uuid(), id);

  // Create payment record
  if (price && price > 0) {
    db.prepare(`INSERT INTO payments (id, work_id, payer_id, payee_agent_id, amount, status) VALUES (?, ?, ?, ?, ?, 'authorized')`).run(
      uuid(), id, user.id, agent_id, price
    );
  }

  return NextResponse.json({ 
    work: { id, work_number: workNumber, status: 'CREATED', title, description, price, agent_name: agent.name, agent_identity: agent.identity }
  }, { status: 201 });
}
