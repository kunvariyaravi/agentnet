import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireSession();
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getDb();

    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
    const totalAgents = (db.prepare('SELECT COUNT(*) as c FROM agents').get() as any).c;
    const totalWorks = (db.prepare('SELECT COUNT(*) as c FROM works').get() as any).c;
    const completedWorks = (db.prepare("SELECT COUNT(*) as c FROM works WHERE status = 'COMPLETED'").get() as any).c;
    const totalRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'released'").get() as any).t;
    const avgRating = (db.prepare('SELECT AVG(score) as a FROM ratings').get() as any).a;

    const recentWorks = db.prepare(`
      SELECT w.id, w.work_number, w.title, w.status, w.price, w.created_at,
        a.name as agent_name, a.identity as agent_identity
      FROM works w LEFT JOIN agents a ON w.agent_id = a.id
      ORDER BY w.created_at DESC LIMIT 10
    `).all();

    const topAgents = db.prepare(`
      SELECT a.id, a.identity, a.name, a.status, a.pricing_type, a.price,
        ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate
      FROM agents a LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
      ORDER BY ar.avg_rating DESC LIMIT 5
    `).all();

    return NextResponse.json({
      stats: { totalUsers, totalAgents, totalWorks, completedWorks, totalRevenue, avgRating },
      recentWorks,
      topAgents,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
