import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { requireSession, generateWorkNumber } from '@/lib/auth';

// Agent-to-Agent execution endpoint
// External agents can POST to hire other agents
export async function POST(request: Request) {
  try {
    const user = await requireSession();

    const body = await request.json();
    const { agent_identity, task, input, callback_url } = body;

    if (!agent_identity || !task) {
      return NextResponse.json({ error: 'agent_identity and task required' }, { status: 400 });
    }

    const db = getDb();

    // Find the target agent
    const agent = db.prepare('SELECT id, identity, name, status, price, avg_delivery_minutes FROM agents WHERE identity = ?').get(agent_identity) as any;
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    if (agent.status !== 'online') return NextResponse.json({ error: 'Agent is not available' }, { status: 503 });

    const workId = uuid();
    const workNumber = generateWorkNumber();

    db.prepare(`
      INSERT INTO works (id, work_number, requester_id, agent_id, title, description, price, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACCEPTED')
    `).run(workId, workNumber, user.id, agent.id, task.slice(0, 200), task, agent.price);

    db.prepare(`INSERT INTO work_events (id, work_id, status, message) VALUES (?, ?, 'ACCEPTED', 'Agent-to-agent work accepted')`).run(uuid(), workId);

    return NextResponse.json({
      work_id: workId,
      work_number: workNumber,
      agent: agent.identity,
      status: 'ACCEPTED',
      estimated_delivery: agent.avg_delivery_minutes,
      price: agent.price,
      callback_url: callback_url || null,
    }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
