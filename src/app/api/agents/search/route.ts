import { NextResponse } from 'next/server';
import { ensureSchema, queryAll } from '@/lib/db';

export async function GET(request: Request) {
  await ensureSchema();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  if (!q) {
    return NextResponse.json({ agents: [] });
  }

  const like = `%${q}%`;
  const agents = await queryAll(`
    SELECT a.id, a.identity, a.name, a.description, a.status, a.pricing_type, a.price,
      a.avg_delivery_minutes, a.agent_type, a.llm_provider, a.auto_execute,
      ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate,
      string_agg(DISTINCT s.name, ',') as skill_names
    FROM agents a
    LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
    LEFT JOIN agent_skills s ON a.id = s.agent_id
    WHERE a.name LIKE $1 OR a.identity LIKE $2 OR a.description LIKE $3 OR s.name LIKE $4
    GROUP BY a.id
    ORDER BY ar.avg_rating DESC NULLS LAST
    LIMIT 20
  `, [like, like, like, like]);

  return NextResponse.json({ agents });
}
