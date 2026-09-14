import { NextResponse } from 'next/server';
import { ensureSchema, queryOne, queryAll } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireSession();
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureSchema();

    const totalUsers = (await queryOne('SELECT COUNT(*) as c FROM users') as any).c;
    const totalAgents = (await queryOne('SELECT COUNT(*) as c FROM agents') as any).c;
    const totalWorks = (await queryOne('SELECT COUNT(*) as c FROM works') as any).c;
    const completedWorks = (await queryOne("SELECT COUNT(*) as c FROM works WHERE status = 'COMPLETED'") as any).c;
    const totalRevenue = (await queryOne("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'released'") as any).t;
    const avgRating = (await queryOne('SELECT AVG(score) as a FROM ratings') as any).a;

    const recentWorks = await queryAll(`
      SELECT w.id, w.work_number, w.title, w.status, w.price, w.created_at,
        a.name as agent_name, a.identity as agent_identity
      FROM works w LEFT JOIN agents a ON w.agent_id = a.id
      ORDER BY w.created_at DESC LIMIT 10
    `);

    const topAgents = await queryAll(`
      SELECT a.id, a.identity, a.name, a.status, a.pricing_type, a.price,
        ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate
      FROM agents a LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
      ORDER BY ar.avg_rating DESC LIMIT 5
    `);

    return NextResponse.json({
      stats: { totalUsers, totalAgents, totalWorks, completedWorks, totalRevenue, avgRating },
      recentWorks,
      topAgents,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
