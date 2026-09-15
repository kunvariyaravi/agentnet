import { NextResponse } from 'next/server';
import { ensureSchema, queryOne, queryAll, run } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureSchema();

  const agent = await queryOne(`
    SELECT a.*, ar.total_works, ar.completed_works, ar.failed_works,
      ar.avg_rating, ar.avg_quality, ar.avg_reliability, ar.avg_speed,
      ar.avg_value, ar.success_rate, ar.total_rated
    FROM agents a
    LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
    WHERE a.id::text = $1 OR a.identity = $1
  `, [id]) as any;

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const skills = await queryAll('SELECT * FROM agent_skills WHERE agent_id = $1', [agent.id]);
  const reviews = await queryAll(`
    SELECT r.*, u.name as reviewer_name, w.work_number
    FROM reviews r
    LEFT JOIN users u ON r.rater_id = u.id
    LEFT JOIN works w ON r.work_id = w.id
    WHERE r.agent_id = $1
    ORDER BY r.created_at DESC
    LIMIT 10
  `, [agent.id]);

  const recentWorks = await queryAll(`
    SELECT w.*, u.name as requester_name
    FROM works w
    LEFT JOIN users u ON w.requester_id = u.id
    WHERE w.agent_id = $1 AND w.status = 'COMPLETED'
    ORDER BY w.completed_at DESC
    LIMIT 5
  `, [agent.id]);

  // Get current user for ownership check
  const user = await getSession();

  // Only return sensitive fields (API key) to the owner
  if (!user || (user.id !== agent.owner_id && user.role !== 'admin')) {
    delete agent.api_key;
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

  await ensureSchema();
  const agent = await queryOne('SELECT * FROM agents WHERE id::text = $1 OR identity = $1', [id]) as any;

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
    await run('UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2', [body.status, agent.id]);
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

  if (name !== undefined) { updates.push(`name = $${updates.length + 1}`); values.push(name); }
  if (description !== undefined) { updates.push(`description = $${updates.length + 1}`); values.push(description); }
  if (pricing_type !== undefined) { updates.push(`pricing_type = $${updates.length + 1}`); values.push(pricing_type); }
  if (price !== undefined) { updates.push(`price = $${updates.length + 1}`); values.push(price); }
  if (endpoint_url !== undefined) { updates.push(`endpoint_url = $${updates.length + 1}`); values.push(endpoint_url || null); }
  if (agent_type !== undefined) { updates.push(`agent_type = $${updates.length + 1}`); values.push(agent_type); }
  if (llm_provider !== undefined) { updates.push(`llm_provider = $${updates.length + 1}`); values.push(llm_provider); }
  if (llm_model !== undefined) { updates.push(`llm_model = $${updates.length + 1}`); values.push(llm_model || null); }
  if (llm_api_key !== undefined) { updates.push(`llm_api_key = $${updates.length + 1}`); values.push(llm_api_key || null); }
  if (llm_base_url !== undefined) { updates.push(`llm_base_url = $${updates.length + 1}`); values.push(llm_base_url || null); }
  if (system_prompt !== undefined) { updates.push(`system_prompt = $${updates.length + 1}`); values.push(system_prompt || null); }
  if (temperature !== undefined) { updates.push(`temperature = $${updates.length + 1}`); values.push(temperature); }
  if (max_tokens !== undefined) { updates.push(`max_tokens = $${updates.length + 1}`); values.push(max_tokens); }
  if (flow_config !== undefined) { updates.push(`flow_config = $${updates.length + 1}`); values.push(JSON.stringify(flow_config)); }
  if (auto_execute !== undefined) { updates.push(`auto_execute = $${updates.length + 1}`); values.push(!!auto_execute); }
  if (status !== undefined) { updates.push(`status = $${updates.length + 1}`); values.push(status); }

  updates.push('updated_at = NOW()');
  values.push(agent.id);

  await run(`UPDATE agents SET ${updates.join(', ')} WHERE id = $${values.length}`, values);

  // Update skills if provided
  if (body.skills !== undefined) {
    // Delete existing skills
    await run('DELETE FROM agent_skills WHERE agent_id = $1', [agent.id]);

    // Insert new skills
    if (Array.isArray(body.skills)) {
      const { v4: uuid } = await import('uuid');
      for (const skill of body.skills) {
        await run(`
          INSERT INTO agent_skills (id, agent_id, name, description, input_types, output_types)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          uuid(), agent.id, skill.name, skill.description || '',
          JSON.stringify(skill.input || []),
          JSON.stringify(skill.output || []),
        ]);
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

  await ensureSchema();
  const agent = await queryOne('SELECT * FROM agents WHERE id::text = $1 OR identity = $1', [id]) as any;

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Only the owner or admin can delete
  if (agent.owner_id !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — only the owner can delete this agent' }, { status: 403 });
  }

  // Check for active works (can't delete if work is in progress)
  const activeWorks = await queryOne(`
    SELECT COUNT(*) as c FROM works
    WHERE agent_id = $1 AND status IN ('CREATED', 'ACCEPTED', 'WORKING', 'INPUT_REQUIRED', 'QUALITY_CHECK')
  `, [agent.id]) as any;

  if (activeWorks.c > 0) {
    return NextResponse.json({
      error: `Cannot delete agent with ${activeWorks.c} active work order(s). Complete or cancel them first.`,
    }, { status: 400 });
  }

  // Clean up ALL related data before deleting the agent in a transaction
  await run('BEGIN');
  try {
    // 1. Delete work-related data (events, outputs, inputs) for this agent's works
    const workIds = (await queryAll('SELECT id FROM works WHERE agent_id = $1', [agent.id])).map((w: any) => w.id);
    if (workIds.length > 0) {
      const placeholders = workIds.map((_, i) => '$' + (i + 1)).join(',');
      await run(`DELETE FROM work_events WHERE work_id IN (${placeholders})`, workIds);
      await run(`DELETE FROM work_outputs WHERE work_id IN (${placeholders})`, workIds);
      await run(`DELETE FROM work_inputs WHERE work_id IN (${placeholders})`, workIds);
    }

    // 2. Delete payments, ratings, reviews that reference this agent
    await run('DELETE FROM payments WHERE payee_agent_id = $1', [agent.id]);
    await run('DELETE FROM ratings WHERE agent_id = $1', [agent.id]);
    await run('DELETE FROM reviews WHERE agent_id = $1', [agent.id]);

    // 3. Delete delegations (both as delegator and via child works)
    await run('DELETE FROM agent_delegations WHERE delegator_agent_id = $1', [agent.id]);

    // 4. Delete works (now safe — no child records left)
    await run('DELETE FROM works WHERE agent_id = $1', [agent.id]);

    // 5. Delete agent metadata
    await run('DELETE FROM agent_reputation WHERE agent_id = $1', [agent.id]);
    await run('DELETE FROM agent_skills WHERE agent_id = $1', [agent.id]);

    // 6. Finally delete the agent
    await run('DELETE FROM agents WHERE id = $1', [agent.id]);

    await run('COMMIT');
  } catch (e) {
    await run('ROLLBACK');
    throw e;
  }

  return NextResponse.json({ success: true });
}
