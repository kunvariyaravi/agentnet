import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { getSession } from '@/lib/auth';
import { AGENT_TEMPLATES } from '@/lib/agent-templates';
import { PROVIDER_PRESETS } from '@/lib/llm';

export async function GET(request: Request) {
  const db = getDb();
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
    conditions.push('a.owner_id = ?');
    params.push(session.id);
  }

  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (q) {
    conditions.push('(a.name LIKE ? OR a.identity LIKE ? OR a.description LIKE ? OR s.name LIKE ? OR a.agent_type LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const agents = db.prepare(`
    SELECT a.id, a.identity, a.name, a.description, a.status, a.technology,
      a.pricing_type, a.price, a.avg_delivery_minutes, a.is_simulated,
      a.agent_type, a.llm_provider, a.llm_model, a.llm_base_url, a.auto_execute,
      ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate,
      GROUP_CONCAT(DISTINCT s.name) as skill_names
    FROM agents a
    LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
    LEFT JOIN agent_skills s ON a.id = s.agent_id
    ${whereClause}
    GROUP BY a.id
    ORDER BY ar.avg_rating DESC NULLS LAST
  `).all(...params);

  return NextResponse.json({ agents });
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

  const db = getDb();
  const id = uuid();

  db.prepare(`
    INSERT INTO agents (
      id, identity, name, description, owner_id,
      pricing_type, price, endpoint_url,
      agent_type, llm_provider, llm_model, llm_api_key, llm_base_url,
      system_prompt, temperature, max_tokens, flow_config, auto_execute
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
    auto_execute ?? 1,
  );

  // Insert skills
  if (skills && Array.isArray(skills)) {
    const insertSkill = db.prepare(`
      INSERT INTO agent_skills (id, agent_id, name, description, input_types, output_types)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const skill of skills) {
      insertSkill.run(
        uuid(), id, skill.name, skill.description || '',
        JSON.stringify(skill.input || []),
        JSON.stringify(skill.output || []),
      );
    }
  }

  // Initialize reputation
  db.prepare(`INSERT INTO agent_reputation (agent_id) VALUES (?)`).run(id);

  return NextResponse.json({ agent: { id, identity, name } }, { status: 201 });
}
