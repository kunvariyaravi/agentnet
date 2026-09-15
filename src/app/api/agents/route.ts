import { NextResponse } from 'next/server';
import { ensureSchema, queryOne, queryAll, run } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { getSession } from '@/lib/auth';
import { AGENT_TEMPLATES } from '@/lib/agent-templates';
import { PROVIDER_PRESETS } from '@/lib/llm';

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const mine = searchParams.get('mine');
    const status = searchParams.get('status');

    // Build query dynamically
    const conditions: string[] = [];
    const params: any[] = [];

    if (mine === 'true') {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      conditions.push(`a.owner_id::text = $${params.length + 1}`);
      params.push(session.id);
    }

    if (status) {
      conditions.push(`a.status = $${params.length + 1}`);
      params.push(status);
    }

    if (q) {
      const like = `%${q}%`;
      conditions.push(`(a.name LIKE $${params.length + 1} OR a.identity LIKE $${params.length + 2} OR a.description LIKE $${params.length + 3} OR s.name LIKE $${params.length + 4} OR a.agent_type LIKE $${params.length + 5})`);
      params.push(like, like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const agents = await queryAll(`
      SELECT a.id, a.identity, a.name, a.description, a.status, a.technology,
        a.pricing_type, a.price, a.avg_delivery_minutes, a.is_simulated,
        a.agent_type, a.llm_provider, a.llm_model, a.llm_base_url, a.auto_execute,
        ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate,
        string_agg(DISTINCT s.name, ',') as skill_names
      FROM agents a
      LEFT JOIN agent_reputation ar ON a.id::text = ar.agent_id::text
      LEFT JOIN agent_skills s ON a.id::text = s.agent_id::text
      ${whereClause}
      GROUP BY a.id, ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate
      ORDER BY ar.avg_rating DESC NULLS LAST
    `, params);

    return NextResponse.json({ agents });
  } catch (err: any) {
    console.error('GET /api/agents failed:', err?.message || err);
    return NextResponse.json(
      { error: 'Failed to load agents. The database is unreachable or slow — please retry.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name, identity, description, skills,
    pricing_type, price, endpoint_url,
    agent_type, llm_provider, llm_model, llm_api_key, llm_base_url,
    system_prompt, temperature, max_tokens, flow_config, auto_execute,
  } = body;

  if (!name || !identity || !description) {
    return NextResponse.json({ error: 'Name, identity, and description required' }, { status: 400 });
  }

  if (!identity.endsWith('.agent')) {
    return NextResponse.json({ error: 'Identity must end with .agent' }, { status: 400 });
  }

  await ensureSchema();
  const id = uuid();

  await run(`
    INSERT INTO agents (
      id, identity, name, description, owner_id,
      pricing_type, price, endpoint_url,
      agent_type, llm_provider, llm_model, llm_api_key, llm_base_url,
      system_prompt, temperature, max_tokens, flow_config, auto_execute
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
  `, [
    id, identity, name, description, user.id,
    pricing_type || 'per_work', price || 0, endpoint_url || null,
    agent_type || 'custom',
    llm_provider || 'nvidia',
    llm_model || null,
    llm_api_key || null,
    llm_base_url || null,
    system_prompt || null,
    temperature ?? 0.7,
    max_tokens ?? 4096,
    JSON.stringify(flow_config || []),
    auto_execute ?? true,
  ]);

  // Insert skills
  if (skills && Array.isArray(skills)) {
    for (const skill of skills) {
      await run(`
        INSERT INTO agent_skills (id, agent_id, name, description, input_types, output_types)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        uuid(), id, skill.name, skill.description || '',
        JSON.stringify(skill.input || []),
        JSON.stringify(skill.output || []),
      ]);
    }
  }

  // Initialize reputation
  await run(`INSERT INTO agent_reputation (agent_id) VALUES ($1)`, [id]);

  return NextResponse.json({ agent: { id, identity, name } }, { status: 201 });
}
