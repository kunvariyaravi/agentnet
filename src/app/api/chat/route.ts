import { NextResponse } from 'next/server';
import { ensureSchema, queryOne, queryAll, run } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { getSession } from '@/lib/auth';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

async function callLLM(messages: { role: string; content: string }[]): Promise<string> {
  if (!NVIDIA_API_KEY) return 'I can help you find the right agent for this task.';
  try {
    const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NVIDIA_API_KEY}` },
      body: JSON.stringify({
        model: 'meta/llama-3.2-11b-vision-instruct',
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch { return ''; }
}

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    await ensureSchema();

    // Get or create conversation
    let convId = conversation_id;
    if (!convId) {
      convId = uuid();
      await run('INSERT INTO conversations (id, user_id, title) VALUES ($1, $2, $3)', [convId, user.id, message.slice(0, 100)]);
    }

    // Save user message
    await run('INSERT INTO messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)', [uuid(), convId, 'user', message]);

    // Search for matching agents
    const agents = await queryAll(`
      SELECT a.id, a.identity, a.name, a.description, a.price, a.avg_delivery_minutes,
        a.status, ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate,
        string_agg(DISTINCT s.name, ',') as skill_names
      FROM agents a
      LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
      LEFT JOIN agent_skills s ON a.id = s.agent_id
      WHERE a.status = 'online'
      GROUP BY a.id
      ORDER BY ar.avg_rating DESC NULLS LAST
    `) as any[];

    const msgLower = message.toLowerCase();
    const matchedAgents = agents.filter(a => {
      const skills = (a.skill_names || '').toLowerCase();
      const desc = (a.description || '').toLowerCase();
      const name = (a.name || '').toLowerCase();
      return msgLower.includes(name) ||
             skills.split(',').some((s: string) => msgLower.includes(s.trim())) ||
             desc.split(' ').some((w: string) => msgLower.includes(w));
    }).slice(0, 3);

    let responseText = '';
    let suggestedAgents = matchedAgents.length > 0 ? matchedAgents : [];
    let directResponse = false;

    if (matchedAgents.length > 0) {
      responseText = `I found ${matchedAgents.length} agent${matchedAgents.length > 1 ? 's' : ''} that can help with this task. Here are the best matches:`;
    } else {
      // No matching agent — respond directly with AI
      const llmResponse = await callLLM([
        { role: 'system', content: `You are AgentNet, an AI assistant that helps users get work done. When users describe a task, you either help them directly or suggest specialized agents. Be concise, helpful, and action-oriented. If the task would benefit from a specialized agent (video, design, code, research, writing, marketing), mention that AgentNet has agents for those capabilities.` },
        { role: 'user', content: message },
      ]);

      if (llmResponse) {
        responseText = llmResponse;
        directResponse = true;
        suggestedAgents = agents.slice(0, 3);
      } else {
        responseText = `I can help you with that. I also found some agents that might be useful for related tasks:`;
        suggestedAgents = agents.slice(0, 3);
      }
    }

    const assistantMessage = JSON.stringify({ text: responseText, agents: suggestedAgents.map((a: any) => ({
      id: a.id, name: a.name, identity: a.identity, description: a.description,
      rating: a.avg_rating, works: a.completed_works, success: a.success_rate,
      price: a.price, delivery: a.avg_delivery_minutes, skills: a.skill_names
    }))});

    await run('INSERT INTO messages (id, conversation_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5)',
      [uuid(), convId, 'assistant', responseText, assistantMessage]
    );

    // Update conversation timestamp
    await run('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [convId]);

    return NextResponse.json({
      conversation_id: convId,
      message: responseText,
      direct_response: directResponse,
      agents: suggestedAgents.map((a: any) => ({
        id: a.id, name: a.name, identity: a.identity, description: a.description,
        rating: a.avg_rating, works: a.completed_works, success: a.success_rate,
        price: a.price, delivery: a.avg_delivery_minutes, skills: a.skill_names
      }))
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const convId = searchParams.get('conversation_id');

    if (convId) {
      // Verify conversation ownership
      const conv = await queryOne('SELECT id FROM conversations WHERE id = $1 AND user_id = $2', [convId, user.id]);
      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      const messages = await queryAll('SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [convId]);
      return NextResponse.json({ messages });
    }

    const conversations = await queryAll('SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20', [user.id]);
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
