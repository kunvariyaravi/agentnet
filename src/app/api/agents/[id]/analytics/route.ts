import { NextResponse } from 'next/server';
import { getAgentAnalytics } from '@/lib/features';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const analytics = getAgentAnalytics(id);
  return NextResponse.json(analytics);
}
