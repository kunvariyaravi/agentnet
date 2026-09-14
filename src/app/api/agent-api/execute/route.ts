import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

// Agent-to-Agent execution endpoint
// External agents can POST to hire other agents
export async function POST(request: Request) {
  const body = await request.json();
  const { agent_identity, task, input, api_key, callback_url } = body;

  if (!agent_identity || !task) {
    return NextResponse.json({ error: 'agent_identity and task required' }, { status: 400 });
  }

  const db = getDb();

  // Find the target agent
  const agent = db.prepare('SELECT * FROM agents WHERE identity = ?').get(agent_identity) as any;
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.status !== 'online') return NextResponse.json({ error: 'Agent is not available' }, { status: 503 });

  // For the MVP, use the first available user as the system requester.
  // In production, agent-to-agent auth would use signed JWTs or API keys.
  const systemUser = db.prepare("SELECT id FROM users LIMIT 1").get() as any;
  if (!systemUser) {
    return NextResponse.json({ error: 'No system account available' }, { status: 500 });
  }

  const workId = uuid();
  const workNumber = `A${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  db.prepare(`
    INSERT INTO works (id, work_number, requester_id, agent_id, title, description, price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACCEPTED')
  `).run(workId, workNumber, systemUser.id, agent.id, task.slice(0, 200), task, agent.price);

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
}
