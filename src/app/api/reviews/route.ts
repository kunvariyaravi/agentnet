import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { work_id, score, quality, reliability, speed, value, title, content } = body;

  if (!work_id || !score) {
    return NextResponse.json({ error: 'Work ID and score required' }, { status: 400 });
  }

  const scoreNum = Number(score);
  if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 5) {
    return NextResponse.json({ error: 'Score must be an integer between 1 and 5' }, { status: 400 });
  }

  const validateRating = (val: any): number | null => {
    const n = Number(val);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };

  const db = getDb();
  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(work_id) as any;
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });
  if (work.status !== 'COMPLETED') return NextResponse.json({ error: 'Can only review completed work' }, { status: 400 });
  if (work.requester_id !== user.id) return NextResponse.json({ error: 'Only the requester can review' }, { status: 403 });

  // Check for existing review
  const existing = db.prepare('SELECT id FROM ratings WHERE work_id = ?').get(work_id);
  if (existing) return NextResponse.json({ error: 'Already reviewed' }, { status: 409 });

  const ratingId = uuid();
  db.prepare(`INSERT INTO ratings (id, work_id, rater_id, agent_id, score, quality, reliability, speed, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    ratingId, work_id, user.id, work.agent_id, scoreNum,
    validateRating(quality), validateRating(reliability), validateRating(speed), validateRating(value)
  );

  if (content) {
    db.prepare(`INSERT INTO reviews (id, work_id, rater_id, agent_id, title, content) VALUES (?, ?, ?, ?, ?, ?)`).run(
      uuid(), work_id, user.id, work.agent_id, title || null, content
    );
  }

  // Update reputation
  const ratingStats = db.prepare(`SELECT COUNT(*) as rated, AVG(score) as avg_rating FROM ratings WHERE agent_id = ?`).get(work.agent_id) as any;
  db.prepare(`UPDATE agent_reputation SET total_rated = ?, avg_rating = ?, updated_at = datetime('now') WHERE agent_id = ?`).run(
    ratingStats.rated, ratingStats.avg_rating, work.agent_id
  );

  return NextResponse.json({ success: true, ratingId });
}
