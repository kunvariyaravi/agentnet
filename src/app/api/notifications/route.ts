import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getNotifications, markNotificationsRead, getUnreadCount } from '@/lib/features';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const notifications = getNotifications(user.id);
  const unreadCount = getUnreadCount(user.id);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PUT(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  markNotificationsRead(user.id, body.ids);

  return NextResponse.json({ success: true });
}
