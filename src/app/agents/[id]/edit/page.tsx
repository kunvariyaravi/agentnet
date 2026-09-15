'use client';

import { useState, useEffect, use } from 'react';
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

interface ProviderPreset {
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
}

const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const labelCls = 'block text-sm font-medium mb-1.5';
const cardCls = 'rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4';

export default function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<any>(null);
  const [providers, setProviders] = useState<Record<string, ProviderPreset>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    identity: '',
    description: '',
    pricing_type: 'per_work',
    price: '0',
    endpoint_url: '',
    agent_type: 'custom',
    llm_provider: 'nvidia',
    llm_model: '',
    llm_api_key: '',
    llm_base_url: '',
    system_prompt: '',
    temperature: '0.7',
    max_tokens: '4096',
    auto_execute: true,
  });

  const [flow, setFlow] = useState<FlowStep[]>([]);
  const [skills, setSkills] = useState<{ name: string; description: string; input: string; output: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/agents/templates').then(r => r.json()),
      fetch(`/api/agents/${id}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([userRes, tplRes, agentRes]) => {
      if (!userRes.user) { router.push('/login'); return; }
      setUser(userRes.user);
      setProviders(tplRes.providers || {});

      const a = agentRes.agent;
      if (!a) { router.push('/agents'); return; }
      if (a.owner_id !== userRes.user.id && userRes.user.role !== 'admin') {
        router.push(`/agents/${id}`); return;
      }

      setForm({
        name: a.name || '',
        identity: a.identity || '',
        description: a.description || '',
        pricing_type: a.pricing_type || 'per_work',
        price: String(a.price || 0),
        endpoint_url: a.endpoint_url || '',
        agent_type: a.agent_type || 'custom',
        llm_provider: a.llm_provider || 'nvidia',
        llm_model: a.llm_model || '',
        llm_api_key: a.llm_api_key || '',
        llm_base_url: a.llm_base_url || '',
        system_prompt: a.system_prompt || 'You are a helpful AI assistant for AgentNet. Complete the requested task thoroughly.',
        temperature: String(a.temperature ?? 0.7),
        max_tokens: String(a.max_tokens ?? 4096),
        auto_execute: a.auto_execute === 1 || a.auto_execute === true,
      });

      try {
        const parsed = JSON.parse(a.flow_config || '[]');
        setFlow(Array.isArray(parsed) && parsed.length > 0 ? parsed : [
          { id: 'generate', type: 'llm_call', name: 'Generate', config: { userPromptTemplate: '{{work.description}}' } },
          { id: 'output', type: 'output', name: 'Output', config: { filenameTemplate: 'result.md', contentTemplate: '{{generate.output}}', outputType: 'markdown' } },
        ]);
      } catch {
        setFlow([
          { id: 'generate', type: 'llm_call', name: 'Generate', config: { userPromptTemplate: '{{work.description}}' } },
          { id: 'output', type: 'output', name: 'Output', config: { filenameTemplate: 'result.md', contentTemplate: '{{generate.output}}', outputType: 'markdown' } },
        ]);
      }

      setSkills(agentRes.skills?.map((s: any) => ({
        name: s.name || '',
        description: s.description || '',
        input: Array.isArray(s.input_types) ? s.input_types.join(', ') : (typeof s.input_types === 'string' ? JSON.parse(s.input_types).join(', ') : ''),
        output: Array.isArray(s.output_types) ? s.output_types.join(', ') : (typeof s.output_types === 'string' ? JSON.parse(s.output_types).join(', ') : ''),
      })) || [{ name: '', description: '', input: '', output: '' }]);

      setLoading(false);
    });
  }, [id, router]);

  const updateForm = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const onProviderChange = (provider: string) => {
    const preset = providers[provider];
    updateForm('llm_provider', provider);
    if (preset) {
      updateForm('llm_base_url', preset.baseUrl);
      if (!form.llm_model) updateForm('llm_model', preset.defaultModel);
    }
  };

  // Flow step management
  const addFlowStep = (type: FlowStep['type']) => {
    const stepId = `step_${Date.now().toString(36)}`;
    const defaults: Record<string, FlowStep> = {
      llm_call: { id: stepId, type, name: 'New LLM Step', config: { userPromptTemplate: '{{work.description}}' } },
      delegate: { id: stepId, type, name: 'New Delegation', config: { agentIdentity: '', taskTemplate: '{{work.description}}' } },
      output: { id: stepId, type, name: 'New Output', config: { filenameTemplate: 'result.md', contentTemplate: '{{generate.output}}', outputType: 'markdown' } },
    };
    setFlow([...flow, defaults[type]]);
  };
  const updateFlowStep = (idx: number, field: string, value: any) => {
    const updated = [...flow];
    if (field === 'type' || field === 'name' || field === 'id') (updated[idx] as any)[field] = value;
    else updated[idx].config = { ...updated[idx].config, [field]: value };
    setFlow(updated);
  };
  const removeFlowStep = (idx: number) => setFlow(flow.filter((_, i) => i !== idx));
  const moveFlowStep = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= flow.length) return;
    const u = [...flow]; [u[idx], u[ni]] = [u[ni], u[idx]]; setFlow(u);
  };

  // Skills
  const addSkill = () => setSkills([...skills, { name: '', description: '', input: '', output: '' }]);
  const removeSkill = (i: number) => setSkills(skills.filter((_, idx) => idx !== i));
  const updateSkill = (i: number, field: string, value: string) => {
    const u = [...skills]; (u[i] as any)[field] = value; setSkills(u);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price) || 0,
          temperature: parseFloat(form.temperature) || 0.7,
          max_tokens: parseInt(form.max_tokens) || 4096,
          flow_config: flow,
          skills: skills.filter(s => s.name).map(s => ({
            name: s.name, description: s.description,
            input: s.input.split(',').map(i => i.trim()).filter(Boolean),
            output: s.output.split(',').map(o => o.trim()).filter(Boolean),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/agents/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Loading...</div>;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Back
            </button>
          </div>
          <h1 className="text-3xl font-bold mb-2">Edit Agent</h1>
          <p className="text-[var(--muted-foreground)] mb-6">Update your agent&apos;s configuration</p>

          {error && <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Basic info */}
            <div className={cardCls}>
              <h2 className="font-semibold">Basic info</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Agent Name</label>
                  <input type="text" value={form.name} onChange={e => updateForm('name', e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Identity (read-only)</label>
                  <input type="text" value={form.identity} readOnly className={`${inputCls} font-mono opacity-60 cursor-not-allowed`} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => updateForm('description', e.target.value)} className={`${inputCls} h-20 resize-none`} required />
              </div>
            </div>

            {/* LLM config */}
            <div className={cardCls}>
              <h2 className="font-semibold">AI configuration</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Provider</label>
                  <select value={form.llm_provider} onChange={e => onProviderChange(e.target.value)} className={inputCls}>
                    {Object.entries(providers).map(([key, p]) => <option key={key} value={key}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Model</label>
                  <input type="text" value={form.llm_model} onChange={e => updateForm('llm_model', e.target.value)} className={`${inputCls} font-mono`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>API Key</label>
                  <input type="password" value={form.llm_api_key} onChange={e => updateForm('llm_api_key', e.target.value)} className={inputCls} placeholder="Leave blank for server default" />
                </div>
                <div>
                  <label className={labelCls}>Base URL</label>
                  <input type="url" value={form.llm_base_url} onChange={e => updateForm('llm_base_url', e.target.value)} className={`${inputCls} font-mono`} />
                </div>
              </div>
              <div>
                <label className={labelCls}>System Prompt</label>
                <textarea value={form.system_prompt} onChange={e => updateForm('system_prompt', e.target.value)} className={`${inputCls} h-32 resize-none font-mono text-xs`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Temperature: {form.temperature}</label>
                  <input type="range" min="0" max="2" step="0.1" value={form.temperature} onChange={e => updateForm('temperature', e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className={labelCls}>Max Tokens</label>
                  <input type="number" min="256" max="32768" step="256" value={form.max_tokens} onChange={e => updateForm('max_tokens', e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Flow builder */}
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Flow builder</h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => addFlowStep('llm_call')} className="text-xs px-2.5 py-1 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20">+ LLM</button>
                  <button type="button" onClick={() => addFlowStep('delegate')} className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">+ Delegate</button>
                  <button type="button" onClick={() => addFlowStep('output')} className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">+ Output</button>
                </div>
              </div>
              {flow.map((step, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-[var(--secondary)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--muted-foreground)] font-mono">#{idx + 1}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${step.type === 'llm_call' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : step.type === 'delegate' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'}`}>{step.type}</span>
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
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>ID:</span>
                    <input type="text" value={step.id} onChange={e => updateFlowStep(idx, 'id', e.target.value)} className="px-2 py-1 rounded bg-[var(--background)] border border-[var(--border)] font-mono text-xs" style={{ width: '200px' }} />
                  </div>
                  {step.type === 'llm_call' && (
                    <div className="space-y-3 pl-2 border-l-2 border-[var(--primary)]/30">
                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] block mb-1">System prompt (optional)</label>
                        <textarea value={step.config.systemPrompt || ''} onChange={e => updateFlowStep(idx, 'systemPrompt', e.target.value)} className={`${inputCls} h-20 resize-none font-mono text-xs`} placeholder="Use agent default if empty" />
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
                        <label className="text-xs text-[var(--muted-foreground)] block mb-1">Task template</label>
                        <textarea value={step.config.taskTemplate || ''} onChange={e => updateFlowStep(idx, 'taskTemplate', e.target.value)} className={`${inputCls} h-16 resize-none font-mono text-xs`} placeholder="{{work.description}}" />
                      </div>
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
            </div>

            {/* Skills */}
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Capabilities</h2>
                <button type="button" onClick={addSkill} className="text-sm text-[var(--primary)] hover:underline">+ Add skill</button>
              </div>
              {skills.map((skill, i) => (
                <div key={i} className="p-4 rounded-lg bg-[var(--secondary)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-foreground)]">Skill {i + 1}</span>
                    {skills.length > 1 && <button type="button" onClick={() => removeSkill(i)} className="text-xs text-red-400 hover:underline">Remove</button>}
                  </div>
                  <input type="text" value={skill.name} onChange={e => updateSkill(i, 'name', e.target.value)} className={`${inputCls} bg-[var(--background)]`} placeholder="Skill name" />
                  <input type="text" value={skill.description} onChange={e => updateSkill(i, 'description', e.target.value)} className={`${inputCls} bg-[var(--background)]`} placeholder="Description" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={skill.input} onChange={e => updateSkill(i, 'input', e.target.value)} className={`${inputCls} bg-[var(--background)] text-xs`} placeholder="Input: code, text" />
                    <input type="text" value={skill.output} onChange={e => updateSkill(i, 'output', e.target.value)} className={`${inputCls} bg-[var(--background)] text-xs`} placeholder="Output: code, report" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing */}
            <div className={cardCls}>
              <h2 className="font-semibold">Pricing</h2>
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

            {/* Auto-execute */}
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold mb-1">Automatic execution</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">When enabled, the agent processes work automatically.</p>
                </div>
                <button type="button" onClick={() => updateForm('auto_execute', !form.auto_execute)} className={`relative h-7 w-12 rounded-full transition-colors ${form.auto_execute ? 'bg-[var(--primary)]' : 'bg-[var(--secondary)]'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${form.auto_execute ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => router.back()} className="flex-1 py-3.5 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--secondary)] transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-3.5 rounded-xl bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
