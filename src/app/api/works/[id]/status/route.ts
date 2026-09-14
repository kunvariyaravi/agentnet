import { NextResponse } from 'next/server';
import { ensureSchema, queryOne, queryAll, run } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { processAgentWork } from '@/lib/worker';
import { getSession } from '@/lib/auth';

// Agent-to-agent or system status updates
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureSchema();
  const body = await request.json();
  const { status, message, api_key, artifact } = body;

  // Verify the agent is authorized
  const work = await queryOne('SELECT * FROM works WHERE id = $1', [id]) as any;
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });

  const agent = await queryOne('SELECT * FROM agents WHERE id = $1', [work.agent_id]) as any;
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  // Require either a valid session (owner or requester) or a valid API key
  const session = await getSession();
  const isOwner = session && (session.id === agent.owner_id || session.id === work.requester_id);
  const isAdmin = session && session.role === 'admin';
  const hasValidApiKey = api_key && agent.api_key && agent.api_key === api_key;

  if (!isOwner && !isAdmin && !hasValidApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const validTransitions: Record<string, string[]> = {
    CREATED: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['WORKING', 'INPUT_REQUIRED', 'CANCELLED'],
    WORKING: ['INPUT_REQUIRED', 'QUALITY_CHECK', 'COMPLETED', 'FAILED'],
    INPUT_REQUIRED: ['WORKING', 'CANCELLED'],
    QUALITY_CHECK: ['COMPLETED', 'WORKING', 'REJECTED'],
  };

  if (!validTransitions[work.status]?.includes(status)) {
    return NextResponse.json({ error: `Invalid transition from ${work.status} to ${status}` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates: string[] = ['status = $1', 'updated_at = $2'];
  const values: any[] = [status, now];

  if (status === 'WORKING' && !work.started_at) {
    updates.push('started_at = $' + (values.length + 1));
    values.push(now);
  }
  if (status === 'COMPLETED') {
    updates.push('completed_at = $' + (values.length + 1));
    values.push(now);
    // Update payment
    await run(`UPDATE payments SET status = 'released' WHERE work_id = $1 AND status = 'authorized'`, [id]);
    // Update agent reputation
    await updateReputation(work.agent_id);
  }
  if (status === 'FAILED') {
    updates.push('completed_at = $' + (values.length + 1));
    values.push(now);
    await updateReputation(work.agent_id);
  }

  values.push(id);
  await run(`UPDATE works SET ${updates.join(', ')} WHERE id = $${values.length}`, values);

  // Log event
  await run(`INSERT INTO work_events (id, work_id, status, message) VALUES ($1, $2, $3, $4)`, [uuid(), id, status, message || `Status updated to ${status}`]);

  // Handle artifact (manual override)
  if (artifact && status === 'COMPLETED') {
    await run(`INSERT INTO work_outputs (id, work_id, file_name, file_url, file_type, artifact_type) VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuid(), id, artifact.name || 'output', artifact.url || '#', artifact.type || 'application/octet-stream', artifact.artifact_type || 'file']
    );
  }

  // Always trigger agent work processing when status becomes WORKING
  if (status === 'WORKING') {
    // Fire and forget — don't block the response
    processAgentWork(id).catch(err => console.error('Worker failed:', err));
  }

  return NextResponse.json({ work: { id, status } });
}

async function updateReputation(agentId: string) {
  const stats = await queryOne(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
    FROM works WHERE agent_id = $1
  `, [agentId]) as any;

  const ratingStats = await queryOne(`
    SELECT 
      COUNT(*) as rated,
      AVG(score) as avg_rating
    FROM ratings WHERE agent_id = $1
  `, [agentId]) as any;

  const successRate = stats.total > 0 ? stats.completed / stats.total : 0;

  await run(`
    UPDATE agent_reputation SET 
      total_works = $1, completed_works = $2, failed_works = $3,
      total_rated = $4, avg_rating = $5, success_rate = $6, updated_at = NOW()
    WHERE agent_id = $7
  `, [stats.total, stats.completed, stats.failed, ratingStats.rated, ratingStats.avg_rating || 0, successRate, agentId]);
}
