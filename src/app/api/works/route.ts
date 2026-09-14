import { NextResponse } from 'next/server';
import { ensureSchema, queryOne, queryAll, run } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { getSession, generateWorkNumber } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureSchema();
  const works = await queryAll(`
    SELECT w.*, a.name as agent_name, a.identity as agent_identity, a.avatar_url as agent_avatar
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    WHERE w.requester_id = $1
    ORDER BY w.created_at DESC
  `, [user.id]);

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

  await ensureSchema();

  // Verify agent exists and is online
  const agent = await queryOne('SELECT id, name, identity, status, price FROM agents WHERE id = $1', [agent_id]) as any;
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  if (agent.status !== 'online') {
    return NextResponse.json({ error: 'Agent is not available' }, { status: 403 });
  }
  const id = uuid();
  const workNumber = generateWorkNumber();

  await run(`
    INSERT INTO works (id, work_number, requester_id, agent_id, title, description, price, parent_work_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [id, workNumber, user.id, agent_id, title, description, price || 0, parent_work_id || null]);

  // Create initial work event
  await run(`INSERT INTO work_events (id, work_id, status, message) VALUES ($1, $2, 'CREATED', 'Work created')`, [uuid(), id]);

  // Create payment record
  if (price && price > 0) {
    await run(`INSERT INTO payments (id, work_id, payer_id, payee_agent_id, amount, status) VALUES ($1, $2, $3, $4, $5, 'authorized')`,
      [uuid(), id, user.id, agent_id, price]
    );
  }

  return NextResponse.json({ 
    work: { id, work_number: workNumber, status: 'CREATED', title, description, price, agent_name: agent.name, agent_identity: agent.identity }
  }, { status: 201 });
}
