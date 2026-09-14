import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPlatformAnalytics } from '@/lib/features';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const analytics = getPlatformAnalytics();
  return NextResponse.json(analytics);
}
