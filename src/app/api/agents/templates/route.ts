import { NextResponse } from 'next/server';
import { AGENT_TEMPLATES } from '@/lib/agent-templates';
import { PROVIDER_PRESETS } from '@/lib/llm';

export async function GET() {
  return NextResponse.json({
    templates: AGENT_TEMPLATES,
    providers: PROVIDER_PRESETS,
  });
}
