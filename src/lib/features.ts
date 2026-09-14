// Advanced features: notifications, work analytics, agent health, SSE streaming
import { getDb } from './db';
import { v4 as uuid } from 'uuid';

// ═══════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════

export function createNotification(userId: string, type: string, title: string, content: string, metadata?: Record<string, any>) {
  const db = getDb();
  db.prepare(`INSERT INTO notifications (id, user_id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuid(), userId, type, title, content, JSON.stringify(metadata || {})
  );
}

export function getUnreadCount(userId: string): number {
  const db = getDb();
  const result = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0`).get(userId) as any;
  return result.c;
}

export function getNotifications(userId: string, limit = 20) {
  const db = getDb();
  return db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).all(userId, limit);
}

export function markNotificationsRead(userId: string, ids?: string[]) {
  const db = getDb();
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND id IN (${placeholders})`).run(userId, ...ids);
  } else {
    db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(userId);
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

export function getAgentAnalytics(agentId: string) {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_works,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status IN ('CREATED','ACCEPTED','WORKING') THEN 1 ELSE 0 END) as active,
      AVG(CASE WHEN status = 'COMPLETED' AND completed_at IS NOT NULL AND started_at IS NOT NULL
        THEN (julianday(completed_at) - julianday(started_at)) * 24 * 60
        ELSE NULL END) as avg_delivery_minutes,
      SUM(price) as total_revenue
    FROM works WHERE agent_id = ?
  `).get(agentId) as any;

  const ratingStats = db.prepare(`
    SELECT
      COUNT(*) as total_rated,
      AVG(score) as avg_rating,
      AVG(quality) as avg_quality,
      AVG(reliability) as avg_reliability,
      AVG(speed) as avg_speed,
      AVG(value) as avg_value
    FROM ratings WHERE agent_id = ?
  `).get(agentId) as any;

  // Works per day (last 30 days)
  const dailyWorks = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM works WHERE agent_id = ? AND created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at) ORDER BY day
  `).all(agentId);

  // Recent reviews
  const recentReviews = db.prepare(`
    SELECT r.*, u.name as reviewer_name, w.work_number
    FROM reviews r
    LEFT JOIN users u ON r.rater_id = u.id
    LEFT JOIN works w ON r.work_id = w.id
    WHERE r.agent_id = ?
    ORDER BY r.created_at DESC LIMIT 5
  `).all(agentId);

  return { stats, ratingStats, dailyWorks, recentReviews };
}

// ═══════════════════════════════════════════
// WORK ANALYTICS (platform-wide)
// ═══════════════════════════════════════════

export function getPlatformAnalytics() {
  const db = getDb();

  const overview = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM agents) as total_agents,
      (SELECT COUNT(*) FROM works) as total_works,
      (SELECT COUNT(*) FROM works WHERE status = 'COMPLETED') as completed_works,
      (SELECT COUNT(*) FROM works WHERE status = 'FAILED') as failed_works,
      (SELECT COUNT(*) FROM works WHERE status IN ('CREATED','ACCEPTED','WORKING')) as active_works,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'released') as total_revenue,
      (SELECT AVG(score) FROM ratings) as avg_rating,
      (SELECT COUNT(*) FROM ratings) as total_ratings
  `).get() as any;

  const topAgents = db.prepare(`
    SELECT a.id, a.name, a.identity, a.price,
      ar.total_works, ar.completed_works, ar.avg_rating, ar.success_rate
    FROM agents a
    LEFT JOIN agent_reputation ar ON a.id = ar.agent_id
    ORDER BY ar.completed_works DESC LIMIT 10
  `).all();

  const recentWorks = db.prepare(`
    SELECT w.*, a.name as agent_name, a.identity as agent_identity, u.name as requester_name
    FROM works w
    LEFT JOIN agents a ON w.agent_id = a.id
    LEFT JOIN users u ON w.requester_id = u.id
    ORDER BY w.created_at DESC LIMIT 20
  `).all();

  const worksByDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
    FROM works WHERE created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at) ORDER BY day
  `).all();

  const topCapabilities = db.prepare(`
    SELECT s.name, COUNT(w.id) as work_count, AVG(r.score) as avg_rating
    FROM agent_skills s
    JOIN works w ON w.agent_id = s.agent_id
    LEFT JOIN ratings r ON r.work_id = w.id
    GROUP BY s.name ORDER BY work_count DESC LIMIT 10
  `).all();

  return { overview, topAgents, recentWorks, worksByDay, topCapabilities };
}

// ═══════════════════════════════════════════
// CONVERSATION HISTORY
// ═══════════════════════════════════════════

export function getConversations(userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as first_message,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    WHERE c.user_id = ?
    ORDER BY c.updated_at DESC
  `).all(userId);
}

export function getConversationMessages(conversationId: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`).all(conversationId);
}
