// Worker module: executes agent flows, supports sub-agent delegation
import { getDb } from './db';
import { v4 as uuid } from 'uuid';
import { callLLM, LLMConfig } from './llm';
import { FlowStep, DEFAULT_FLOW } from './agent-templates';

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
  const db = getDb();
  const work = db.prepare(`
    SELECT w.*, a.name as agent_name, a.identity as agent_identity,
      a.agent_type, a.llm_provider, a.llm_model, a.llm_api_key, a.llm_base_url,
      a.system_prompt, a.temperature, a.max_tokens, a.flow_config, a.auto_execute
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    WHERE w.id = ?
  `).get(workId) as any;

  if (!work) return '';
  if (work.status !== 'WORKING') return '';

  try {
    // Parse flow config
    let flow: FlowStep[] = [];
    try {
      flow = JSON.parse(work.flow_config || '[]');
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
        const result = executeOutputStep(step, context, workId);
        if (result) finalContent = result;
      }
    }

    // If no explicit output step produced content, use the last LLM output
    if (!finalContent) {
      const lastOutput = Object.values(stepOutputs).pop() || '';
      if (lastOutput) {
        finalContent = lastOutput;
        const slug = slugify(work.title);
        saveOutput(db, workId, `${slug}.md`, lastOutput);
      }
    }

    // Mark complete
    completeWork(db, workId, work.agent_id);
    return finalContent;

  } catch (error: any) {
    console.error(`Worker error for ${workId}:`, error);
    failWork(db, workId, work.agent_id, error.message || 'Work failed');
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
  const db = getDb();
  const systemPrompt = step.config.systemPrompt || agentSystemPrompt;
  const userPrompt = resolveTemplate(step.config.userPromptTemplate || '{{work.description}}', context);

  const stepConfig: LLMConfig = {
    ...llmConfig,
    model: step.config.model || llmConfig.model,
    temperature: step.config.temperature ?? llmConfig.temperature,
    maxTokens: step.config.maxTokens ?? llmConfig.maxTokens,
  };

  logEvent(db, workId, 'WORKING', `Executing: ${step.name}`);

  const output = await callLLM(stepConfig, systemPrompt, userPrompt);
  context.step[step.id] = output;
  // Also store as {stepId: {output: ...}} so {{stepId.output}} templates resolve correctly
  context[step.id] = { output };

  logEvent(db, workId, 'WORKING', `Completed: ${step.name} (${output.length} chars)`, {
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
  const db = getDb();
  const agentIdentity = resolveTemplate(step.config.agentIdentity || '', context);
  const taskDescription = resolveTemplate(step.config.taskTemplate || '{{work.description}}', context);

  const targetAgent = db.prepare('SELECT * FROM agents WHERE identity = ?').get(agentIdentity) as any;

  if (!targetAgent) {
    context.step[step.id] = `[Delegation failed: agent "${agentIdentity}" not found]`;
    logEvent(db, workId, 'WORKING', `Delegation failed: agent "${agentIdentity}" not found`);
    return;
  }

  // Create child work order
  const childWorkId = uuid();
  const childWorkNumber = `DELEG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  db.prepare(`
    INSERT INTO works (id, work_number, requester_id, agent_id, title, description, status, parent_work_id, created_at, started_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'WORKING', ?, datetime('now'), datetime('now'), datetime('now'))
  `).run(
    childWorkId,
    childWorkNumber,
    work.requester_id,
    targetAgent.id,
    `[Delegated] ${step.name}`,
    taskDescription,
    workId,
  );

  // Record delegation
  db.prepare(`
    INSERT INTO agent_delegations (id, parent_work_id, child_work_id, delegator_agent_id)
    VALUES (?, ?, ?, ?)
  `).run(uuid(), workId, childWorkId, work.agent_id);

  logEvent(db, workId, 'WORKING', `Delegated to ${agentIdentity}: ${step.name}`, {
    step: step.id,
    childWorkId,
    agentIdentity,
  });

  // Process child work recursively
  const childOutput = await processAgentWork(childWorkId, true);
  context.step[step.id] = childOutput;
  context[step.id] = { output: childOutput };

  logEvent(db, workId, 'WORKING', `Delegation completed: ${step.name} (${childOutput.length} chars)`, {
    step: step.id,
    childWorkId,
  });
}

function executeOutputStep(
  step: FlowStep,
  context: Record<string, any>,
  workId: string,
): string | null {
  const db = getDb();
  const content = resolveTemplate(step.config.contentTemplate || '{{work.description}}', context);
  let filename = resolveTemplate(step.config.filenameTemplate || 'result.md', context);
  const outputType = step.config.outputType || 'markdown';

  // Fallback filename if template resolved to empty or just an extension like ".md"
  if (!filename || filename.startsWith('.')) {
    filename = `${slugify(context.work?.title || 'result')}.md`;
  }

  // Skip saving if content is empty
  if (!content || content.trim() === '') {
    logEvent(db, workId, 'WORKING', `Output step skipped (empty content for: ${filename})`, {
      step: step.id,
      filename,
      outputType,
    });
    return null;
  }

  saveOutput(db, workId, filename, content);

  logEvent(db, workId, 'WORKING', `Output saved: ${filename} (${content.length} chars)`, {
    step: step.id,
    filename,
    outputType,
  });

  return content;
}

// ── Helpers ──

function saveOutput(db: any, workId: string, filename: string, content: string): void {
  // Don't save empty content — creates confusing NULL records
  if (!content || content.trim() === '') return;

  // Save as file artifact (with data URL for download)
  db.prepare(`
    INSERT INTO work_outputs (id, work_id, file_name, file_url, file_type, artifact_type)
    VALUES (?, ?, ?, ?, ?, 'file')
  `).run(
    uuid(),
    workId,
    filename,
    `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`,
    'text/markdown',
  );

  // Save as content artifact (raw content for UI display)
  db.prepare(`
    INSERT INTO work_outputs (id, work_id, file_name, file_url, file_type, artifact_type)
    VALUES (?, ?, ?, ?, ?, 'content')
  `).run(uuid(), workId, filename, content, 'text/markdown');
}

function logEvent(db: any, workId: string, status: string, message: string, metadata?: any): void {
  db.prepare(`
    INSERT INTO work_events (id, work_id, status, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuid(), workId, status, message, JSON.stringify(metadata || {}));
}

function completeWork(db: any, workId: string, agentId: string): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE works SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?`)
    .run(now, now, workId);
  logEvent(db, workId, 'COMPLETED', 'Work completed successfully');
  db.prepare(`UPDATE payments SET status = 'released' WHERE work_id = ? AND status = 'authorized'`)
    .run(workId);
  updateReputation(db, agentId);
}

function failWork(db: any, workId: string, agentId: string, errorMessage: string): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE works SET status = 'FAILED', completed_at = ?, updated_at = ? WHERE id = ?`)
    .run(now, now, workId);
  logEvent(db, workId, 'FAILED', errorMessage);
  updateReputation(db, agentId);
}

function updateReputation(db: any, agentId: string): void {
  const stats = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
    FROM works WHERE agent_id = ?
  `).get(agentId);

  const ratingStats = db.prepare(`
    SELECT COUNT(*) as rated, AVG(score) as avg_rating
    FROM ratings WHERE agent_id = ?
  `).get(agentId);

  const successRate = stats.total > 0 ? stats.completed / stats.total : 0;

  db.prepare(`
    UPDATE agent_reputation SET
      total_works = ?, completed_works = ?, failed_works = ?,
      total_rated = ?, avg_rating = ?, success_rate = ?, updated_at = datetime('now')
    WHERE agent_id = ?
  `).run(
    stats.total,
    stats.completed,
    stats.failed,
    ratingStats.rated,
    ratingStats.avg_rating || 0,
    successRate,
    agentId,
  );
}
