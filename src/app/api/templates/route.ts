import { NextResponse } from 'next/server';
import { WORK_TEMPLATES } from '@/lib/features';

export async function GET() {
  return NextResponse.json({ templates: WORK_TEMPLATES });
}
