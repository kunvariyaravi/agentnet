// Advanced features: notifications, work analytics, agent health, SSE streaming
import { queryOne, queryAll, run, ensureSchema } from './db';

// ═══════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════

export async function createNotification(userId: string, type: string, title: string, content: string, metadata?: Record<string, any>) {
  await ensureSchema();
  await run(
    'INSERT INTO notifications (user_id, type, title, content, metadata) VALUES ($1, $2, $3, $4, $5)',
    [userId, type, title, content, JSON.stringify(metadata || {})]
  );
}

export async function getUnreadCount(userId: string): Promise<number> {
  await ensureSchema();
  const result = await queryOne<{ c: number }>(
    'SELECT COUNT(*)::int as c FROM notifications WHERE user_id = $1 AND read = FALSE',
    [userId]
  );
  return result?.c ?? 0;
}

export async function getNotifications(userId: string, limit = 20) {
  await ensureSchema();
  return queryAll('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  await ensureSchema();
  if (ids && ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    await run(`UPDATE notifications SET read = TRUE WHERE user_id = $1 AND id IN (${placeholders})`, [userId, ...ids]);
  } else {
    await run('UPDATE notifications SET read = TRUE WHERE user_id = $1', [userId]);
  }
}

// ═══════════════════════════════════════════
// WORK TEMPLATES (pre-built task patterns)
// ═══════════════════════════════════════════

export interface WorkTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  suggestedAgent: string;
  prompt: string;
  icon: string;
}

export const WORK_TEMPLATES: WorkTemplate[] = [
  {
    id: 'blog-post',
    name: 'Blog Post',
    description: 'Write an engaging blog post on any topic',
    category: 'Writing',
    suggestedAgent: 'writer.agent',
    prompt: 'Write a well-structured blog post about {topic}. Include an introduction, 3-4 main sections with headers, and a conclusion. Make it informative and engaging.',
    icon: '📝',
  },
  {
    id: 'research-report',
    name: 'Research Report',
    description: 'Deep research on a company, market, or technology',
    category: 'Research',
    suggestedAgent: 'research.agent',
    prompt: 'Research {topic} and produce a comprehensive report. Include executive summary, key findings, analysis, and recommendations.',
    icon: '🔬',
  },
  {
    id: 'product-video',
    name: 'Product Video Plan',
    description: 'Create a video production plan from a concept',
    category: 'Video',
    suggestedAgent: 'alex.agent',
    prompt: 'Create a detailed video production plan for: {topic}. Include shot list, timing, visual descriptions, and production notes.',
    icon: '🎬',
  },
  {
    id: 'code-project',
    name: 'Build Something',
    description: 'Generate code for a web app, API, or tool',
    category: 'Development',
    suggestedAgent: 'code.agent',
    prompt: 'Build {topic}. Provide complete, working code with clear comments. Include setup instructions.',
    icon: '💻',
  },
  {
    id: 'design-brief',
    name: 'Design Brief',
    description: 'Create a design specification or brand identity',
    category: 'Design',
    suggestedAgent: 'design.agent',
    prompt: 'Create a detailed design brief for {topic}. Include color palette, typography, layout, and component specifications.',
    icon: '🎨',
  },
  {
    id: 'marketing-campaign',
    name: 'Marketing Campaign',
    description: 'Plan a complete marketing campaign',
    category: 'Marketing',
    suggestedAgent: 'marketing.agent',
    prompt: 'Plan a comprehensive marketing campaign for {topic}. Include strategy, channels, content calendar, and KPIs.',
    icon: '📈',
  },
];

// ═══════════════════════════════════════════
// AGENT HEALTH / ANALYTICS
// ═══════════════════════════════════════════

export async function getAgentAnalytics(agentId: string) {
  await ensureSchema();

  const stats = await queryOne(`
    SELECT
      COUNT(*)::int as total_works,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)::int as completed,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END)::int as failed,
      SUM(CASE WHEN status IN ('CREATED','ACCEPTED','WORKING') THEN 1 ELSE 0 END)::int as active,
      AVG(CASE WHEN status = 'COMPLETED' AND completed_at IS NOT NULL AND started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
        ELSE NULL END) as avg_delivery_minutes,
      SUM(price) as total_revenue
    FROM works WHERE agent_id = $1
  `, [agentId]);

  const ratingStats = await queryOne(`
    SELECT
      COUNT(*)::int as total_rated,
      AVG(score) as avg_rating,
      AVG(quality) as avg_quality,
      AVG(reliability) as avg_reliability,
      AVG(speed) as avg_speed,
      AVG(value) as avg_value
    FROM ratings WHERE agent_id = $1
  `, [agentId]);

  // Works per day (last 30 days)
  const dailyWorks = await queryAll(`
    SELECT DATE(created_at) as day, COUNT(*)::int as count
    FROM works WHERE agent_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at) ORDER BY day
  `, [agentId]);

  // Recent reviews
  const recentReviews = await queryAll(`
    SELECT r.id, r.work_id, r.score, r.title, r.content, r.created_at,
      u.name as reviewer_name, w.work_number
    FROM reviews r
    LEFT JOIN users u ON r.rater_id = u.id
    LEFT JOIN works w ON r.work_id = w.id
    WHERE r.agent_id = $1
    ORDER BY r.created_at DESC LIMIT 5
  `, [agentId]);

  return { stats, ratingStats, dailyWorks, recentReviews };
}

// ═══════════════════════════════════════════
// WORK ANALYTICS (platform-wide)
// ═══════════════════════════════════════════

export async function getPlatformAnalytics() {
  await ensureSchema();

  const overview = await queryOne(`
    SELECT
      (SELECT COUNT(*)::int FROM users) as total_users,
      (SELECT COUNT(*)::int FROM agents) as total_agents,
      (SELECT COUNT(*)::int FROM works) as total_works,
      (SELECT COUNT(*)::int FROM works WHERE status = 'COMPLETED') as completed_works,
      (SELECT COUNT(*)::int FROM works WHERE status = 'FAILED') as failed_works,
      (SELECT COUNT(*)::int FROM works WHERE status IN ('CREATED','ACCEPTED','WORKING')) as active_works,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'released') as total_revenue,
      (SELECT AVG(score) FROM ratings) as avg_rating,
      (SELECT COUNT(*)::int FROM ratings) as total_ratings
  `);

  const topAgents = await queryAll(`
    SELECT a.id, a.name, a.identity, a.price,
      ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate
    FROM agents a
    LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
    ORDER BY ar.completed_works DESC LIMIT 10
  `);

  const recentWorks = await queryAll(`
    SELECT w.id, w.work_number, w.title, w.status, w.price, w.created_at,
      a.name as agent_name, a.identity as agent_identity, u.name as requester_name
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    LEFT JOIN users u ON w.requester_id = u.id
    ORDER BY w.created_at DESC LIMIT 20
  `);

  const worksByDay = await queryAll(`
    SELECT DATE(created_at) as day, COUNT(*)::int as count,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)::int as completed
    FROM works WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at) ORDER BY day
  `);

  const topCapabilities = await queryAll(`
    SELECT s.name, COUNT(w.id)::int as work_count, AVG(r.score) as avg_rating
    FROM agent_skills s
    JOIN works w ON w.agent_id = s.agent_id
    LEFT JOIN ratings r ON r.work_id = w.id
    GROUP BY s.name ORDER BY work_count DESC LIMIT 10
  `);

  return { overview, topAgents, recentWorks, worksByDay, topCapabilities };
}

// ═══════════════════════════════════════════
// CONVERSATION HISTORY
// ═══════════════════════════════════════════

export async function getConversations(userId: string) {
  await ensureSchema();
  return queryAll(`
    SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at,
      (SELECT content FROM messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as first_message,
      (SELECT COUNT(*)::int FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    WHERE c.user_id = $1
    ORDER BY c.updated_at DESC
  `, [userId]);
}

export async function getConversationMessages(conversationId: string) {
  await ensureSchema();
  return queryAll('SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [conversationId]);
}
