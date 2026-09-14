import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { processAgentWork } from '@/lib/worker';
import { getSession } from '@/lib/auth';

// Agent-to-agent or system status updates
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { status, message, api_key, artifact } = body;

  // Verify the agent is authorized
  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(id) as any;
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(work.agent_id) as any;
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
  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const values: any[] = [status, now];

  if (status === 'WORKING' && !work.started_at) {
    updates.push('started_at = ?');
    values.push(now);
  }
  if (status === 'COMPLETED') {
    updates.push('completed_at = ?');
    values.push(now);
    // Update payment
    db.prepare(`UPDATE payments SET status = 'released' WHERE work_id = ? AND status = 'authorized'`).run(id);
    // Update agent reputation
    updateReputation(db, work.agent_id);
  }
  if (status === 'FAILED') {
    updates.push('completed_at = ?');
    values.push(now);
    updateReputation(db, work.agent_id);
  }

  values.push(id);
  db.prepare(`UPDATE works SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  // Log event
  db.prepare(`INSERT INTO work_events (id, work_id, status, message) VALUES (?, ?, ?, ?)`).run(uuid(), id, status, message || `Status updated to ${status}`);

  // Handle artifact (manual override)
  if (artifact && status === 'COMPLETED') {
    db.prepare(`INSERT INTO work_outputs (id, work_id, file_name, file_url, file_type, artifact_type) VALUES (?, ?, ?, ?, ?, ?)`).run(
      uuid(), id, artifact.name || 'output', artifact.url || '#', artifact.type || 'application/octet-stream', artifact.artifact_type || 'file'
    );
  }

  // Always trigger agent work processing when status becomes WORKING
  if (status === 'WORKING') {
    // Fire and forget — don't block the response
    processAgentWork(id).catch(err => console.error('Worker failed:', err));
  }

  return NextResponse.json({ work: { id, status } });
}

function updateReputation(db: any, agentId: string) {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
    FROM works WHERE agent_id = ?
  `).get(agentId);

  const ratingStats = db.prepare(`
    SELECT 
      COUNT(*) as rated,
      AVG(score) as avg_rating
    FROM ratings WHERE agent_id = ?
  `).get(agentId);

  const successRate = stats.total > 0 ? stats.completed / stats.total : 0;

  db.prepare(`
    UPDATE agent_reputation SET 
      total_works = ?, completed_works = ?, failed_works = ?,
      total_rated = ?, avg_rating = ?, success_rate = ?, updated_at = datetime('now')
    WHERE agent_id = ?
  `).run(stats.total, stats.completed, stats.failed, ratingStats.rated, ratingStats.avg_rating || 0, successRate, agentId);
}
