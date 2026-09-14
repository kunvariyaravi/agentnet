import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const agent = db.prepare(`
    SELECT a.*, ar.total_works, ar.completed_works, ar.failed_works,
      ar.avg_rating, ar.avg_quality, ar.avg_reliability, ar.avg_speed,
      ar.avg_value, ar.success_rate, ar.total_rated
    FROM agents a
    LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
    WHERE a.id = ? OR a.identity = ?
  `).get(id, id) as any;

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const skills = db.prepare('SELECT * FROM agent_skills WHERE agent_id = ?').all(agent.id);
  const reviews = db.prepare(`
    SELECT r.*, u.name as reviewer_name, w.work_number
    FROM reviews r
    LEFT JOIN users u ON r.rater_id = u.id
    LEFT JOIN works w ON r.work_id = w.id
    WHERE r.agent_id = ?
    ORDER BY r.created_at DESC
    LIMIT 10
  `).all(agent.id);

  const recentWorks = db.prepare(`
    SELECT w.*, u.name as requester_name
    FROM works w
    LEFT JOIN users u ON w.requester_id = u.id
    WHERE w.agent_id = ? AND w.status = 'COMPLETED'
    ORDER BY w.completed_at DESC
    LIMIT 5
  `).all(agent.id);

  // Get current user for ownership check
  const user = await getSession();

  // Only return sensitive fields (API key) to the owner
  if (!user || (user.id !== agent.owner_id && user.role !== 'admin')) {
    delete agent.llm_api_key;
    delete agent.flow_config;
    delete agent.system_prompt;
    delete agent.llm_model;
    delete agent.llm_base_url;
    delete agent.llm_provider;
    delete agent.temperature;
    delete agent.max_tokens;
  } else {
    agent.is_owner = true;
  }

  return NextResponse.json({ agent, skills, reviews, recentWorks });
}

// ── Update agent (PUT) ──
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? OR identity = ?').get(id, id) as any;

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Only the owner or admin can edit
  if (agent.owner_id !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — only the owner can edit this agent' }, { status: 403 });
  }

  const body = await request.json();

  // Quick status toggle (activate/deactivate)
  if (body.status && Object.keys(body).length === 1) {
    const validStatuses = ['online', 'offline', 'busy', 'maintenance'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    db.prepare('UPDATE agents SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(body.status, agent.id);
    return NextResponse.json({ agent: { id: agent.id, status: body.status } });
  }

  // Full update
  const {
    name, description, pricing_type, price, endpoint_url,
    agent_type, llm_provider, llm_model, llm_api_key, llm_base_url,
    system_prompt, temperature, max_tokens, flow_config, auto_execute,
    status,
  } = body;

  // Build dynamic update
  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (pricing_type !== undefined) { updates.push('pricing_type = ?'); values.push(pricing_type); }
  if (price !== undefined) { updates.push('price = ?'); values.push(price); }
  if (endpoint_url !== undefined) { updates.push('endpoint_url = ?'); values.push(endpoint_url || null); }
  if (agent_type !== undefined) { updates.push('agent_type = ?'); values.push(agent_type); }
  if (llm_provider !== undefined) { updates.push('llm_provider = ?'); values.push(llm_provider); }
  if (llm_model !== undefined) { updates.push('llm_model = ?'); values.push(llm_model || null); }
  if (llm_api_key !== undefined) { updates.push('llm_api_key = ?'); values.push(llm_api_key || null); }
  if (llm_base_url !== undefined) { updates.push('llm_base_url = ?'); values.push(llm_base_url || null); }
  if (system_prompt !== undefined) { updates.push('system_prompt = ?'); values.push(system_prompt || null); }
  if (temperature !== undefined) { updates.push('temperature = ?'); values.push(temperature); }
  if (max_tokens !== undefined) { updates.push('max_tokens = ?'); values.push(max_tokens); }
  if (flow_config !== undefined) { updates.push('flow_config = ?'); values.push(JSON.stringify(flow_config)); }
  if (auto_execute !== undefined) { updates.push('auto_execute = ?'); values.push(auto_execute ? 1 : 0); }
  if (status !== undefined) { updates.push('status = ?'); values.push(status); }

  updates.push('updated_at = datetime(\'now\')');
  values.push(agent.id);

  db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  // Update skills if provided
  if (body.skills !== undefined) {
    // Delete existing skills
    db.prepare('DELETE FROM agent_skills WHERE agent_id = ?').run(agent.id);

    // Insert new skills
    if (Array.isArray(body.skills)) {
      const { v4: uuid } = await import('uuid');
      const insertSkill = db.prepare(`
        INSERT INTO agent_skills (id, agent_id, name, description, input_types, output_types)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const skill of body.skills) {
        insertSkill.run(
          uuid(), agent.id, skill.name, skill.description || '',
          JSON.stringify(skill.input || []),
          JSON.stringify(skill.output || []),
        );
      }
    }
  }

  return NextResponse.json({ agent: { id: agent.id, identity: agent.identity } });
}

// ── Delete agent (DELETE) ──
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? OR identity = ?').get(id, id) as any;

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Only the owner or admin can delete
  if (agent.owner_id !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — only the owner can delete this agent' }, { status: 403 });
  }

  // Check for active works (can't delete if work is in progress)
  const activeWorks = db.prepare(`
    SELECT COUNT(*) as c FROM works
    WHERE agent_id = ? AND status IN ('CREATED', 'ACCEPTED', 'WORKING', 'INPUT_REQUIRED', 'QUALITY_CHECK')
  `).get(agent.id) as any;

  if (activeWorks.c > 0) {
    return NextResponse.json({
      error: `Cannot delete agent with ${activeWorks.c} active work order(s). Complete or cancel them first.`,
    }, { status: 400 });
  }

  // Clean up ALL related data before deleting the agent
  // Order matters: child tables first, then parent tables

  // 1. Delete work-related data (events, outputs, inputs) for this agent's works
  const workIds = db.prepare('SELECT id FROM works WHERE agent_id = ?').all(agent.id).map((w: any) => w.id);
  if (workIds.length > 0) {
    const placeholders = workIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM work_events WHERE work_id IN (${placeholders})`).run(...workIds);
    db.prepare(`DELETE FROM work_outputs WHERE work_id IN (${placeholders})`).run(...workIds);
    db.prepare(`DELETE FROM work_inputs WHERE work_id IN (${placeholders})`).run(...workIds);
  }

  // 2. Delete payments, ratings, reviews that reference this agent
  db.prepare('DELETE FROM payments WHERE payee_agent_id = ?').run(agent.id);
  db.prepare('DELETE FROM ratings WHERE agent_id = ?').run(agent.id);
  db.prepare('DELETE FROM reviews WHERE agent_id = ?').run(agent.id);

  // 3. Delete delegations (both as delegator and via child works)
  db.prepare('DELETE FROM agent_delegations WHERE delegator_agent_id = ?').run(agent.id);

  // 4. Delete works (now safe — no child records left)
  db.prepare('DELETE FROM works WHERE agent_id = ?').run(agent.id);

  // 5. Delete agent metadata
  db.prepare('DELETE FROM agent_reputation WHERE agent_id = ?').run(agent.id);
  db.prepare('DELETE FROM agent_skills WHERE agent_id = ?').run(agent.id);

  // 6. Finally delete the agent
  db.prepare('DELETE FROM agents WHERE id = ?').run(agent.id);

  return NextResponse.json({ success: true });
}
