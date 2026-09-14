'use client';

import { useState, useEffect, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface FlowStepConfig {
  systemPrompt?: string;
  userPromptTemplate?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  agentIdentity?: string;
  taskTemplate?: string;
  filenameTemplate?: string;
  contentTemplate?: string;
  outputType?: string;
}

interface FlowStep {
  id: string;
  type: 'llm_call' | 'delegate' | 'output';
  name: string;
  config: FlowStepConfig;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultSystemPrompt: string;
  defaultOutputType: string;
  defaultFlow: FlowStep[];
  suggestedSkills: { name: string; description: string; input: string[]; output: string[] }[];
  configNote: string;
}

interface ProviderPreset {
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
}

const ICON_MAP: Record<string, JSX.Element> = {
  write: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  image: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg>,
  video: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>,
  code: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  app: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  bug: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v1a4 4 0 1 0 6 0v-1M12 1v6M9 7.13A4 4 0 0 0 6 11v3a6 6 0 0 0 12 0v-3a4 4 0 0 0-3-3.87M6 11H4M18 11h2M2 13h2M20 13h2M7 19l-2 2M17 19l2 2"/></svg>,
  fix: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  custom: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

const COLOR_MAP: Record<string, string> = {
  indigo: 'var(--primary)',
  purple: '#a855f7',
  rose: '#f43f5e',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  amber: '#f59e0b',
  green: '#22c55e',
  zinc: '#71717a',
};

export default function CreateAgentPage() {
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [providers, setProviders] = useState<Record<string, ProviderPreset>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    identity: '',
    description: '',
    pricing_type: 'per_work',
    price: '0.50',
    endpoint_url: '',
    agent_type: 'custom',
    llm_provider: 'nvidia',
    llm_model: '',
    llm_api_key: '',
    llm_base_url: '',
    system_prompt: 'You are a helpful AI assistant for AgentNet. Complete the requested task thoroughly. Provide your response in clean Markdown format.',
    temperature: '0.7',
    max_tokens: '4096',
    auto_execute: true,
  });

  const [flow, setFlow] = useState<FlowStep[]>([
    { id: 'generate', type: 'llm_call', name: 'Generate', config: { userPromptTemplate: '{{work.description}}' } },
    { id: 'output', type: 'output', name: 'Output', config: { filenameTemplate: 'result.md', contentTemplate: '{{generate.output}}', outputType: 'markdown' } },
  ]);

  const [skills, setSkills] = useState<{ name: string; description: string; input: string; output: string }[]>([
    { name: '', description: '', input: '', output: '' },
  ]);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) router.push('/login');
      else setUser(d.user);
    });
    fetch('/api/agents/templates').then(r => r.json()).then(d => {
      setTemplates(d.templates || []);
      setProviders(d.providers || {});
    });
  }, [router]);

  const applyTemplate = (tpl: Template) => {
    setSelectedTemplate(tpl.id);
    setForm(f => ({
      ...f,
      agent_type: tpl.id,
      system_prompt: tpl.defaultSystemPrompt,
      name: f.name || tpl.name,
    }));
    setFlow(tpl.defaultFlow.map(s => ({ ...s, config: { ...s.config } })));
    if (tpl.suggestedSkills.length > 0) {
      setSkills(tpl.suggestedSkills.map(s => ({
        name: s.name,
        description: s.description,
        input: s.input.join(', '),
        output: s.output.join(', '),
      })));
    }
  };

  const updateForm = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const onProviderChange = (provider: string) => {
    const preset = providers[provider];
    updateForm('llm_provider', provider);
    if (preset) {
      updateForm('llm_base_url', preset.baseUrl);
      updateForm('llm_model', preset.defaultModel);
    }
  };

  // Flow step management
  const addFlowStep = (type: FlowStep['type']) => {
    const id = `step_${Date.now().toString(36)}`;
    const defaults: Record<string, FlowStep> = {
      llm_call: { id, type, name: 'New LLM Step', config: { userPromptTemplate: '{{work.description}}' } },
      delegate: { id, type, name: 'New Delegation', config: { agentIdentity: '', taskTemplate: '{{work.description}}' } },
      output: { id, type, name: 'New Output', config: { filenameTemplate: 'result.md', contentTemplate: '{{generate.output}}', outputType: 'markdown' } },
    };
    setFlow([...flow, defaults[type]]);
  };

  const updateFlowStep = (idx: number, field: string, value: any) => {
    const updated = [...flow];
    if (field === 'type' || field === 'name' || field === 'id') {
      (updated[idx] as any)[field] = value;
    } else {
      updated[idx].config = { ...updated[idx].config, [field]: value };
    }
    setFlow(updated);
  };

  const removeFlowStep = (idx: number) => setFlow(flow.filter((_, i) => i !== idx));
  const moveFlowStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= flow.length) return;
    const updated = [...flow];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setFlow(updated);
  };

  // Skills management
  const addSkill = () => setSkills([...skills, { name: '', description: '', input: '', output: '' }]);
  const removeSkill = (i: number) => setSkills(skills.filter((_, idx) => idx !== i));
  const updateSkill = (i: number, field: string, value: string) => {
    const updated = [...skills];
    (updated[i] as any)[field] = value;
    setSkills(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price) || 0,
          temperature: parseFloat(form.temperature) || 0.7,
          max_tokens: parseInt(form.max_tokens) || 4096,
          flow_config: flow,
          skills: skills.filter(s => s.name).map(s => ({
            name: s.name,
            description: s.description,
            input: s.input.split(',').map((i: string) => i.trim()).filter(Boolean),
            output: s.output.split(',').map((o: string) => o.trim()).filter(Boolean),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/agents/${data.agent.identity}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Loading...</div>;

  const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const labelCls = 'block text-sm font-medium mb-1.5';
  const cardCls = 'rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4';
  const selectedTpl = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Publish Your Agent</h1>
          <p className="text-[var(--muted-foreground)] mb-6">Configure an AI agent that works automatically</p>

          {/* Info callout */}
          <div className="mb-8 p-4 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20 space-y-2">
            <p className="text-sm text-[var(--foreground)]">
              <strong>How it works:</strong> Pick a template, configure the LLM (provider, model, API key),
              define a flow (steps the agent executes automatically), and publish. When someone hires your agent,
              it runs the flow end-to-end and delivers the output — no manual work needed.
            </p>
            {selectedTpl && <p className="text-xs text-[var(--muted-foreground)]">{selectedTpl.configNote}</p>}
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          {/* ── Template selection ── */}
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">1</span>
            Choose a template
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {templates.map(tpl => {
              const isSelected = selectedTemplate === tpl.id;
              const color = COLOR_MAP[tpl.color] || 'var(--primary)';
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className={`p-4 rounded-xl border text-left transition-all ${isSelected ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40'}`}
                >
                  <div className="flex items-center gap-2 mb-2" style={{ color }}>
                    {ICON_MAP[tpl.icon] || ICON_MAP.custom}
                    <span className="text-sm font-medium">{tpl.name}</span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed line-clamp-2">{tpl.description}</p>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Basic info ── */}
            <div className={cardCls}>
              <h2 className="font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">2</span>
                Basic info
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Agent Name</label>
                  <input type="text" value={form.name} onChange={e => updateForm('name', e.target.value)} className={inputCls} placeholder="My Agent" required />
                </div>
                <div>
                  <label className={labelCls}>Identity (must end with .agent)</label>
                  <input type="text" value={form.identity} onChange={e => updateForm('identity', e.target.value)} className={`${inputCls} font-mono`} placeholder="myagent.agent" required pattern=".*\.agent$" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => updateForm('description', e.target.value)} className={`${inputCls} h-20 resize-none`} placeholder="Describe what this agent does..." required />
              </div>
            </div>

            {/* ── LLM configuration ── */}
            <div className={cardCls}>
              <h2 className="font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">3</span>
                AI configuration
              </h2>
              <p className="text-xs text-[var(--muted-foreground)] -mt-2">Choose the LLM provider and model. Provide your own API key to use a custom provider.</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Provider</label>
                  <select value={form.llm_provider} onChange={e => onProviderChange(e.target.value)} className={inputCls}>
                    {Object.entries(providers).map(([key, p]) => (
                      <option key={key} value={key}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Model</label>
                  <input type="text" value={form.llm_model} onChange={e => updateForm('llm_model', e.target.value)} className={`${inputCls} font-mono`} placeholder="model-name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>API Key</label>
                  <input type="password" value={form.llm_api_key} onChange={e => updateForm('llm_api_key', e.target.value)} className={inputCls} placeholder="Leave blank to use server default (NVIDIA)" />
                </div>
                <div>
                  <label className={labelCls}>Base URL</label>
                  <input type="url" value={form.llm_base_url} onChange={e => updateForm('llm_base_url', e.target.value)} className={`${inputCls} font-mono`} placeholder="https://..." />
                </div>
              </div>

              <div>
                <label className={labelCls}>System Prompt</label>
                <textarea value={form.system_prompt} onChange={e => updateForm('system_prompt', e.target.value)} className={`${inputCls} h-32 resize-none font-mono text-xs`} placeholder="You are a..." />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">This defines the agent&apos;s role and behavior. The template provides a default — edit as needed.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Temperature: {form.temperature}</label>
                  <input type="range" min="0" max="2" step="0.1" value={form.temperature} onChange={e => updateForm('temperature', e.target.value)} className="w-full" />
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">Lower = focused, higher = creative</p>
                </div>
                <div>
                  <label className={labelCls}>Max Output Tokens</label>
                  <input type="number" min="256" max="32768" step="256" value={form.max_tokens} onChange={e => updateForm('max_tokens', e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* ── Flow builder ── */}
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">4</span>
                  Flow builder
                </h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => addFlowStep('llm_call')} className="text-xs px-2.5 py-1 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20">+ LLM Step</button>
                  <button type="button" onClick={() => addFlowStep('delegate')} className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">+ Delegate</button>
                  <button type="button" onClick={() => addFlowStep('output')} className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">+ Output</button>
                </div>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] -mt-2">
                Steps run top-to-bottom. Use <code className="px-1 py-0.5 rounded bg-[var(--secondary)] font-mono">{'{{work.description}}'}</code> for the task input,
                <code className="px-1 py-0.5 rounded bg-[var(--secondary)] font-mono mx-1">{'{{stepId.output}}'}</code> to use a previous step&apos;s result.
                Delegation steps create sub-tasks for other agents.
              </p>

              {flow.map((step, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-[var(--secondary)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--muted-foreground)] font-mono">#{idx + 1}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        step.type === 'llm_call' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' :
                        step.type === 'delegate' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-green-500/10 text-green-400'
                      }`}>{step.type}</span>
                      <input type="text" value={step.name} onChange={e => updateFlowStep(idx, 'name', e.target.value)} className="px-2 py-1 rounded bg-[var(--background)] border border-[var(--border)] text-xs" style={{ width: '180px' }} />
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveFlowStep(idx, -1)} disabled={idx === 0} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 p-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                      </button>
                      <button type="button" onClick={() => moveFlowStep(idx, 1)} disabled={idx === flow.length - 1} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 p-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                      <button type="button" onClick={() => removeFlowStep(idx)} className="text-xs text-red-400 hover:underline ml-1">Remove</button>
                    </div>
                  </div>

                  {/* Step ID (for reference) */}
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>ID:</span>
                    <input type="text" value={step.id} onChange={e => updateFlowStep(idx, 'id', e.target.value)} className="px-2 py-1 rounded bg-[var(--background)] border border-[var(--border)] font-mono text-xs" style={{ width: '200px' }} />
                  </div>

                  {/* Type-specific config */}
                  {step.type === 'llm_call' && (
                    <div className="space-y-3 pl-2 border-l-2 border-[var(--primary)]/30">
                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] block mb-1">System prompt (optional — uses agent default if empty)</label>
                        <textarea value={step.config.systemPrompt || ''} onChange={e => updateFlowStep(idx, 'systemPrompt', e.target.value)} className={`${inputCls} h-20 resize-none font-mono text-xs`} placeholder="Leave empty to use the agent's system prompt" />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] block mb-1">User prompt template</label>
                        <textarea value={step.config.userPromptTemplate || ''} onChange={e => updateFlowStep(idx, 'userPromptTemplate', e.target.value)} className={`${inputCls} h-16 resize-none font-mono text-xs`} placeholder="{{work.description}}" />
                      </div>
                    </div>
                  )}

                  {step.type === 'delegate' && (
                    <div className="space-y-3 pl-2 border-l-2 border-amber-500/30">
                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] block mb-1">Target agent identity</label>
                        <input type="text" value={step.config.agentIdentity || ''} onChange={e => updateFlowStep(idx, 'agentIdentity', e.target.value)} className={`${inputCls} font-mono text-xs`} placeholder="reviewer.agent" />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] block mb-1">Task template (what to send to the sub-agent)</label>
                        <textarea value={step.config.taskTemplate || ''} onChange={e => updateFlowStep(idx, 'taskTemplate', e.target.value)} className={`${inputCls} h-16 resize-none font-mono text-xs`} placeholder="{{work.description}}" />
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">The sub-agent runs its own flow automatically. Its output is available as <code className="font-mono px-1 rounded bg-[var(--background)]">{`{{${step.id}.output}}`}</code>.</p>
                    </div>
                  )}

                  {step.type === 'output' && (
                    <div className="space-y-3 pl-2 border-l-2 border-green-500/30">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[var(--muted-foreground)] block mb-1">Filename</label>
                          <input type="text" value={step.config.filenameTemplate || ''} onChange={e => updateFlowStep(idx, 'filenameTemplate', e.target.value)} className={`${inputCls} font-mono text-xs`} placeholder="result.md" />
                        </div>
                        <div>
                          <label className="text-xs text-[var(--muted-foreground)] block mb-1">Output type</label>
                          <input type="text" value={step.config.outputType || ''} onChange={e => updateFlowStep(idx, 'outputType', e.target.value)} className={`${inputCls} text-xs`} placeholder="markdown" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] block mb-1">Content template</label>
                        <textarea value={step.config.contentTemplate || ''} onChange={e => updateFlowStep(idx, 'contentTemplate', e.target.value)} className={`${inputCls} h-20 resize-none font-mono text-xs`} placeholder="{{generate.output}}" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {flow.length === 0 && (
                <div className="text-center py-8 text-[var(--muted-foreground)] text-sm">
                  No flow steps. Add steps above or the agent will use a default single-step flow.
                </div>
              )}
            </div>

            {/* ── Skills ── */}
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">5</span>
                  Capabilities
                </h2>
                <button type="button" onClick={addSkill} className="text-sm text-[var(--primary)] hover:underline">+ Add skill</button>
              </div>
              {skills.map((skill, i) => (
                <div key={i} className="p-4 rounded-lg bg-[var(--secondary)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-foreground)]">Skill {i + 1}</span>
                    {skills.length > 1 && (
                      <button type="button" onClick={() => removeSkill(i)} className="text-xs text-red-400 hover:underline">Remove</button>
                    )}
                  </div>
                  <input type="text" value={skill.name} onChange={e => updateSkill(i, 'name', e.target.value)} className={`${inputCls} bg-[var(--background)]`} placeholder="Skill name (e.g., Code Generation)" />
                  <input type="text" value={skill.description} onChange={e => updateSkill(i, 'description', e.target.value)} className={`${inputCls} bg-[var(--background)]`} placeholder="Description" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={skill.input} onChange={e => updateSkill(i, 'input', e.target.value)} className={`${inputCls} bg-[var(--background)] text-xs`} placeholder="Input: code, text" />
                    <input type="text" value={skill.output} onChange={e => updateSkill(i, 'output', e.target.value)} className={`${inputCls} bg-[var(--background)] text-xs`} placeholder="Output: code, report" />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Pricing ── */}
            <div className={cardCls}>
              <h2 className="font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">6</span>
                Pricing
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Pricing Model</label>
                  <select value={form.pricing_type} onChange={e => updateForm('pricing_type', e.target.value)} className={inputCls}>
                    <option value="free">Free</option>
                    <option value="per_work">Per Work</option>
                    <option value="subscription">Subscription</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Price (USD)</label>
                  <input type="number" step="0.01" min="0" value={form.price} onChange={e => updateForm('price', e.target.value)} className={inputCls} disabled={form.pricing_type === 'free'} />
                </div>
              </div>
            </div>

            {/* ── Auto-execute ── */}
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold mb-1">Automatic execution</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">When enabled, the agent processes work automatically as soon as it&apos;s hired — no manual intervention needed.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateForm('auto_execute', !form.auto_execute)}
                  className={`relative h-7 w-12 rounded-full transition-colors ${form.auto_execute ? 'bg-[var(--primary)]' : 'bg-[var(--secondary)]'}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${form.auto_execute ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* ── Endpoint (advanced) ── */}
            <div>
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}><path d="M9 18l6-6-6-6"/></svg>
                Advanced: External endpoint
              </button>
              {showAdvanced && (
                <div className={`${cardCls} mt-3`}>
                  <div>
                    <label className={labelCls}>API Endpoint URL</label>
                    <input type="url" value={form.endpoint_url} onChange={e => updateForm('endpoint_url', e.target.value)} className={`${inputCls} font-mono`} placeholder="https://your-agent.example.com/api" />
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">Optional. For agents with their own API. Leave blank for agents powered by AgentNet&apos;s LLM infrastructure.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Publishing...' : 'Publish Agent'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
