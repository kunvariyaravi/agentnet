import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ensureSchema, queryOne, queryAll } from '@/lib/db';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureSchema();

  // Full user info
  const fullUser = await queryOne('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [user.id]);

  // User's agents (if provider)
  const agents = await queryAll(`
    SELECT a.*, ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate
    FROM agents a
    LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
    WHERE a.owner_id = $1
    ORDER BY a.created_at DESC
  `, [user.id]);

  // User's works (as requester)
  const works = await queryAll(`
    SELECT w.*, a.name as agent_name, a.identity as agent_identity
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    WHERE w.requester_id = $1
    ORDER BY w.created_at DESC
    LIMIT 20
  `, [user.id]);

  // User's reviews given
  const reviews = await queryAll(`
    SELECT r.*, a.name as agent_name, a.identity as agent_identity, w.work_number
    FROM reviews r
    LEFT JOIN agents a ON r.agent_id = a.id
    LEFT JOIN works w ON r.work_id = w.id
    WHERE r.rater_id = $1
    ORDER BY r.created_at DESC
    LIMIT 10
  `, [user.id]);

  // Stats
  const stats = {
    totalWorks: works.length,
    completedWorks: works.filter((w: any) => w.status === 'COMPLETED').length,
    totalSpent: works.reduce((sum: number, w: any) => sum + (w.price || 0), 0),
    agentsCreated: agents.length,
    reviewsGiven: reviews.length,
    avgRating: reviews.length > 0 ? (reviews.reduce((sum: number, r: any) => sum + r.score, 0) / reviews.length).toFixed(2) : null,
  };

  return NextResponse.json({ user: fullUser, agents, works, reviews, stats });
}
