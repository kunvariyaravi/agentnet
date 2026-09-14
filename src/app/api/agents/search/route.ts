import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  if (!q) {
    return NextResponse.json({ agents: [] });
  }

  const agents = db.prepare(`
    SELECT a.id, a.identity, a.name, a.description, a.status, a.pricing_type, a.price,
      a.avg_delivery_minutes, a.agent_type, a.llm_provider, a.auto_execute,
      ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate,
      GROUP_CONCAT(DISTINCT s.name) as skill_names
    FROM agents a
    LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
    LEFT JOIN agent_skills s ON a.id = s.agent_id
    WHERE a.name LIKE ? OR a.identity LIKE ? OR a.description LIKE ? OR s.name LIKE ?
    GROUP BY a.id
    ORDER BY ar.avg_rating DESC NULLS LAST
    LIMIT 20
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  return NextResponse.json({ agents });
}
