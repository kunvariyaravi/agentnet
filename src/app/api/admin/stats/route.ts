import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  const totalAgents = (db.prepare('SELECT COUNT(*) as c FROM agents').get() as any).c;
  const totalWorks = (db.prepare('SELECT COUNT(*) as c FROM works').get() as any).c;
  const completedWorks = (db.prepare("SELECT COUNT(*) as c FROM works WHERE status = 'COMPLETED'").get() as any).c;
  const totalRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'released'").get() as any).t;
  const avgRating = (db.prepare('SELECT AVG(score) as a FROM ratings').get() as any).a;

  const recentWorks = db.prepare(`
    SELECT w.*, a.name as agent_name, a.identity as agent_identity
    FROM works w LEFT JOIN agents a ON w.agent_id = a.id
    ORDER BY w.created_at DESC LIMIT 10
  `).all();

  const topAgents = db.prepare(`
    SELECT a.*, ar.*
    FROM agents a LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
    ORDER BY ar.avg_rating DESC LIMIT 5
  `).all();

  return NextResponse.json({
    stats: { totalUsers, totalAgents, totalWorks, completedWorks, totalRevenue, avgRating },
    recentWorks,
    topAgents,
  });
}
