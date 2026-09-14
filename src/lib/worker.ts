// Worker module: executes agent flows, supports sub-agent delegation
import { queryOne, queryAll, run, ensureSchema } from './db';
import { v4 as uuid } from 'uuid';
import { callLLM, LLMConfig } from './llm';
import { FlowStep, DEFAULT_FLOW } from './agent-templates';
import { generateWorkNumber } from './auth';

// ── Template variable resolution ──
// Supports: {{work.description}}, {{work.title}}, {{stepId.output}}
// Also handles {{work.title slug}} suffix to slugify the result
function resolveTemplate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, rawKey: string) => {
    let key = rawKey.trim();
    let slugifyResult = false;

    // Handle "slug" suffix: {{work.title slug}} → resolve work.title, then slugify
    if (key.endsWith(' slug')) {
      key = key.slice(0, -5).trim();
      slugifyResult = true;
    }

    const parts = key.split('.');
    let val: any = context;
    for (const part of parts) {
      if (val == null) return '';
      val = val[part];
    }

    // Fallback: if not found in context, check step outputs
    // e.g., {{draft.output}} → context.step.draft
    if (val == null && context.step && parts.length >= 1) {
      val = context.step[parts[0]];
      // If val is a string (step output) and there's a sub-key like "output", just return the string
      if (typeof val === 'string' && parts.length > 1) {
        // {{stepId.output}} → the string IS the output
      } else {
        for (let i = 1; i < parts.length; i++) {
          if (val == null) break;
          val = val[parts[i]];
        }
      }
    }

    const result = val != null ? String(val) : '';
    return slugifyResult ? slugify(result) : result;
  });
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'result';
}

// ── Main entry point ──
export async function processAgentWork(workId: string, isChild = false): Promise<string> {
  await ensureSchema();
  const work = await queryOne(`
    SELECT w.id, w.agent_id, w.requester_id, w.title, w.description, w.status,
      a.name as agent_name, a.identity as agent_identity,
      a.agent_type, a.llm_provider, a.llm_model, a.llm_api_key, a.llm_base_url,
      a.system_prompt, a.temperature, a.max_tokens, a.flow_config, a.auto_execute
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    WHERE w.id = $1
  `, [workId]);

  if (!work) return '';
  if (work.status !== 'WORKING') return '';

  try {
    // Parse flow config
    let flow: FlowStep[] = [];
    try {
      flow = typeof work.flow_config === 'string' ? JSON.parse(work.flow_config || '[]') : (work.flow_config || []);
    } catch {
      flow = [];
    }
    if (!flow.length || flow.length === 0) flow = DEFAULT_FLOW;

    // Build LLM config from agent settings
    const llmConfig: LLMConfig = {
      provider: work.llm_provider || 'nvidia',
      model: work.llm_model || '',
      apiKey: work.llm_api_key || '',
      baseUrl: work.llm_base_url || '',
      temperature: work.temperature ?? 0.7,
      maxTokens: work.max_tokens ?? 4096,
    };

    // System prompt
    const agentSystemPrompt = work.system_prompt ||
      'You are a helpful AI assistant for AgentNet. Complete the requested task thoroughly. Provide your response in clean Markdown format.';

    // Context for template resolution
    const stepOutputs: Record<string, string> = {};
    const context: Record<string, any> = {
      work: {
        description: work.description,
        title: work.title,
        id: work.id,
      },
    };

    let finalContent = '';

    for (const step of flow) {
      context.step = stepOutputs;

      if (step.type === 'llm_call') {
        await executeLLMStep(step, context, llmConfig, agentSystemPrompt, workId);
      } else if (step.type === 'delegate') {
        await executeDelegateStep(step, context, work, workId);
      } else if (step.type === 'output') {
        const result = await executeOutputStep(step, context, workId);
        if (result) finalContent = result;
      }
    }

    // If no explicit output step produced content, use the last LLM output
    if (!finalContent) {
      const lastOutput = Object.values(stepOutputs).pop() || '';
      if (lastOutput) {
        finalContent = lastOutput;
        const slug = slugify(work.title);
        await saveOutput(workId, `${slug}.md`, lastOutput);
      }
    }

    // Mark complete
    await completeWork(workId, work.agent_id);
    return finalContent;

  } catch (error: any) {
    console.error(`Worker error for ${workId}:`, error);
    await failWork(workId, work.agent_id, error.message || 'Work failed');
    return '';
  }
}

// ── Step executors ──

async function executeLLMStep(
  step: FlowStep,
  context: Record<string, any>,
  llmConfig: LLMConfig,
  agentSystemPrompt: string,
  workId: string,
): Promise<void> {
  const systemPrompt = step.config.systemPrompt || agentSystemPrompt;
  const userPrompt = resolveTemplate(step.config.userPromptTemplate || '{{work.description}}', context);

  const stepConfig: LLMConfig = {
    ...llmConfig,
    model: step.config.model || llmConfig.model,
    temperature: step.config.temperature ?? llmConfig.temperature,
    maxTokens: step.config.maxTokens ?? llmConfig.maxTokens,
  };

  await logEvent(workId, 'WORKING', `Executing: ${step.name}`);

  const output = await callLLM(stepConfig, systemPrompt, userPrompt);
  context.step[step.id] = output;
  // Also store as {stepId: {output: ...}} so {{stepId.output}} templates resolve correctly
  context[step.id] = { output };

  await logEvent(workId, 'WORKING', `Completed: ${step.name} (${output.length} chars)`, {
    step: step.id,
    outputLength: output.length,
  });
}

async function executeDelegateStep(
  step: FlowStep,
  context: Record<string, any>,
  work: any,
  workId: string,
): Promise<void> {
  const agentIdentity = resolveTemplate(step.config.agentIdentity || '', context);
  const taskDescription = resolveTemplate(step.config.taskTemplate || '{{work.description}}', context);

  const targetAgent = await queryOne<{ id: string }>('SELECT id FROM agents WHERE identity = $1', [agentIdentity]);

  if (!targetAgent) {
    context.step[step.id] = `[Delegation failed: agent "${agentIdentity}" not found]`;
    await logEvent(workId, 'WORKING', `Delegation failed: agent "${agentIdentity}" not found`);
    return;
  }

  // Create child work order
  const childWorkId = uuid();
  const childWorkNumber = generateWorkNumber();

  await run(`
    INSERT INTO works (id, work_number, requester_id, agent_id, title, description, status, parent_work_id, created_at, started_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'WORKING', $7, NOW(), NOW(), NOW())
  `, [
    childWorkId,
    childWorkNumber,
    work.requester_id,
    targetAgent.id,
    `[Delegated] ${step.name}`,
    taskDescription,
    workId,
  ]);

  // Record delegation
  await run(`
    INSERT INTO agent_delegations (id, parent_work_id, child_work_id, delegator_agent_id)
    VALUES ($1, $2, $3, $4)
  `, [uuid(), workId, childWorkId, work.agent_id]);

  await logEvent(workId, 'WORKING', `Delegated to ${agentIdentity}: ${step.name}`, {
    step: step.id,
    childWorkId,
    agentIdentity,
  });

  // Process child work recursively
  const childOutput = await processAgentWork(childWorkId, true);
  context.step[step.id] = childOutput;
  context[step.id] = { output: childOutput };

  await logEvent(workId, 'WORKING', `Delegation completed: ${step.name} (${childOutput.length} chars)`, {
    step: step.id,
    childWorkId,
  });
}

async function executeOutputStep(
  step: FlowStep,
  context: Record<string, any>,
  workId: string,
): Promise<string | null> {
  const content = resolveTemplate(step.config.contentTemplate || '{{work.description}}', context);
  let filename = resolveTemplate(step.config.filenameTemplate || 'result.md', context);
  const outputType = step.config.outputType || 'markdown';

  // Fallback filename if template resolved to empty or just an extension like ".md"
  if (!filename || filename.startsWith('.')) {
    filename = `${slugify(context.work?.title || 'result')}.md`;
  }

  // Skip saving if content is empty
  if (!content || content.trim() === '') {
    await logEvent(workId, 'WORKING', `Output step skipped (empty content for: ${filename})`, {
      step: step.id,
      filename,
      outputType,
    });
    return null;
  }

  await saveOutput(workId, filename, content);

  await logEvent(workId, 'WORKING', `Output saved: ${filename} (${content.length} chars)`, {
    step: step.id,
    filename,
    outputType,
  });

  return content;
}

// ── Helpers ──

async function saveOutput(workId: string, filename: string, content: string): Promise<void> {
  // Don't save empty content — creates confusing NULL records
  if (!content || content.trim() === '') return;

  // Save as file artifact (with data URL for download)
  await run(`
    INSERT INTO work_outputs (id, work_id, file_name, file_url, file_type, artifact_type)
    VALUES ($1, $2, $3, $4, $5, 'file')
  `, [
    uuid(),
    workId,
    filename,
    `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`,
    'text/markdown',
  ]);

  // Save as content artifact (raw content for UI display)
  await run(`
    INSERT INTO work_outputs (id, work_id, file_name, file_url, file_type, artifact_type)
    VALUES ($1, $2, $3, $4, $5, 'content')
  `, [uuid(), workId, filename, content, 'text/markdown']);
}

async function logEvent(workId: string, status: string, message: string, metadata?: any): Promise<void> {
  await run(`
    INSERT INTO work_events (id, work_id, status, message, metadata)
    VALUES ($1, $2, $3, $4, $5)
  `, [uuid(), workId, status, message, JSON.stringify(metadata || {})]);
}

async function completeWork(workId: string, agentId: string): Promise<void> {
  await run(`UPDATE works SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [workId]);
  await logEvent(workId, 'COMPLETED', 'Work completed successfully');
  await run(`UPDATE payments SET status = 'released' WHERE work_id = $1 AND status = 'authorized'`, [workId]);
  await updateReputation(agentId);
}

async function failWork(workId: string, agentId: string, errorMessage: string): Promise<void> {
  await run(`UPDATE works SET status = 'FAILED', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [workId]);
  await logEvent(workId, 'FAILED', errorMessage);
  await updateReputation(agentId);
}

async function updateReputation(agentId: string): Promise<void> {
  const stats = await queryOne(`
    SELECT COUNT(*)::int as total,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)::int as completed,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END)::int as failed
    FROM works WHERE agent_id = $1
  `, [agentId]);

  const ratingStats = await queryOne(`
    SELECT COUNT(*)::int as rated, AVG(score) as avg_rating
    FROM ratings WHERE agent_id = $1
  `, [agentId]);

  const successRate = (stats?.total ?? 0) > 0 ? (stats?.completed ?? 0) / (stats?.total ?? 1) : 0;

  await run(`
    UPDATE agent_reputation SET
      total_works = $1, completed_works = $2, failed_works = $3,
      total_rated = $4, avg_rating = $5, success_rate = $6, updated_at = NOW()
    WHERE agent_id = $7
  `, [
    stats?.total ?? 0,
    stats?.completed ?? 0,
    stats?.failed ?? 0,
    ratingStats?.rated ?? 0,
    ratingStats?.avg_rating ?? 0,
    successRate,
    agentId,
  ]);
}
