'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agents?: any[];
  work?: any;
  workContent?: string;
}

const completedWorkIds = new Set<string>();

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="mesh-bg min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Loading...</div>}>
      <WorkspaceContent />
    </Suspense>
  );
}

function WorkspaceContent() {
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeWorkId, setActiveWorkId] = useState<string | null>(null);
  const [workStatus, setWorkStatus] = useState<string>('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) router.push('/login');
      else {
        setUser(d.user);
        loadConversations();
      }
    });
  }, [router]);

  // Handle ?work=X query param (from agent detail page Hire button)
  useEffect(() => {
    const workParam = searchParams.get('work');
    if (!workParam || !user) return;

    fetch(`/api/works/${workParam}`).then(r => r.json()).then(data => {
      if (!data.work) return;
      const work = data.work;
      setActiveWorkId(work.id);
      setWorkStatus(work.status);

      // If work already completed, show results immediately
      if (work.status === 'COMPLETED' && data.outputs?.length > 0) {
        const contentOutputs = (data.outputs || []).filter((o: any) =>
          o.artifact_type === 'content' && o.file_url && o.file_url.trim() !== ''
        );
        const fileOutputs = (data.outputs || []).filter((o: any) =>
          o.artifact_type === 'file' && o.file_name
        );
        const contentOutput = contentOutputs[contentOutputs.length - 1];
        const fileOutput = fileOutputs[fileOutputs.length - 1];
        const content = contentOutput?.file_url || '';
        const artifactName = fileOutput?.file_name || 'output.md';

        setMessages([{
          role: 'assistant',
          content: `Hired **${work.agent_name || 'Agent'}** (${work.agent_identity}) for $${work.price || 0}/work.`,
          work: work,
          workContent: content,
        }]);
      } else {
        setMessages([{
          role: 'assistant',
          content: `Hired **${work.agent_name || 'Agent'}** (${work.agent_identity}) for $${work.price || 0}/work.\n\nAgent is processing your request...`,
          work: work,
        }]);

        if (work.status === 'CREATED') {
          fetch(`/api/works/${work.id}/status`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'ACCEPTED' }),
          }).then(() => {
            setWorkStatus('ACCEPTED');
            setTimeout(() => {
              fetch(`/api/works/${work.id}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: 'WORKING' }),
              }).then(() => setWorkStatus('WORKING'));
            }, 1500);
          });
        }
      }
    }).catch(() => {});
  }, [searchParams, user]);

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {}
  };

  const loadConversation = async (id: string) => {
    const res = await fetch(`/api/conversations?id=${id}`);
    const data = await res.json();
    const loadedMessages: Message[] = (data.messages || []).map((m: any) => ({
      role: m.role,
      content: m.content,
      ...JSON.parse(m.metadata || '{}'),
    }));
    setMessages(loadedMessages);
    setConversationId(id);
    setSidebarOpen(false);
  };

  const startNew = () => {
    setMessages([]);
    setConversationId(null);
    setActiveWorkId(null);
    setWorkStatus('');
    completedWorkIds.clear();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll work status
  useEffect(() => {
    if (!activeWorkId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/works/${activeWorkId}`);
        const data = await res.json();
        if (!data.work) return;
        setWorkStatus(data.work.status);

        if ((data.work.status === 'COMPLETED' || data.work.status === 'FAILED') && !completedWorkIds.has(activeWorkId)) {
          completedWorkIds.add(activeWorkId);
          clearInterval(interval);

          if (data.work.status === 'COMPLETED') {
            const contentOutputs = (data.outputs || []).filter((o: any) =>
              o.artifact_type === 'content' && o.file_url && o.file_url.trim() !== ''
            );
            const fileOutputs = (data.outputs || []).filter((o: any) =>
              o.artifact_type === 'file' && o.file_name
            );
            const contentOutput = contentOutputs[contentOutputs.length - 1];
            const fileOutput = fileOutputs[fileOutputs.length - 1];
            const content = contentOutput?.file_url || '';
            const artifactName = fileOutput?.file_name || 'output.md';

            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Work **#${data.work.work_number}** is complete!`,
              work: data.work,
              workContent: content,
            }]);
          } else {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Work **#${data.work.work_number}** failed. The agent was unable to complete this task.`,
              work: data.work,
            }]);
          }
          loadConversations();
        }
      } catch {}
    }, 2500);
    return () => clearInterval(interval);
  }, [activeWorkId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: userMessage, conversation_id: conversationId }),
      });
      const data = await res.json();
      if (data.conversation_id) setConversationId(data.conversation_id);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        agents: data.agents,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleHire = async (agent: any) => {
    const userMessages = messages.filter(m => m.role === 'user');
    const taskMessage = userMessages[userMessages.length - 1]?.content || input;
    if (!taskMessage.trim()) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Please describe your task first, then I can match you with the right agent.' }]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/works', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          agent_id: agent.id,
          title: taskMessage.slice(0, 200),
          description: taskMessage,
          price: agent.price,
        }),
      });
      const data = await res.json();
      completedWorkIds.delete(data.work.id);
      setActiveWorkId(data.work.id);
      setWorkStatus('CREATED');

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Hired **${agent.name}** (${agent.identity}) for $${agent.price}/work.`,
        work: data.work,
      }]);

      await fetch(`/api/works/${data.work.id}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });
      setWorkStatus('ACCEPTED');

      setTimeout(async () => {
        await fetch(`/api/works/${data.work.id}/status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'WORKING' }),
        });
        setWorkStatus('WORKING');
      }, 1500);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to hire agent. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (workId: string, score: number) => {
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ work_id: workId, score }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: `Rated ${score}/5. Thank you for your feedback!` }]);
    } catch {}
  };

  const suggestions = [
    { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Write a blog post', sub: 'about AI in healthcare' },
    { icon: 'M9 17v-2m3 2V9m3 8V5M9 7h6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z', label: 'Research a topic', sub: 'market analysis for SaaS' },
    { icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4 4 4 4', label: 'Generate code', sub: 'React component library' },
    { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'Create content', sub: 'product description copy' },
  ];

  if (!user) return <div className="mesh-bg min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Loading...</div>;

  return (
    <div className="mesh-bg min-h-screen flex">
      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-64 glass border-r border-white/5 transition-transform lg:translate-x-0 lg:static lg:w-64 flex flex-col`}>
        <div className="p-3 border-b border-white/5">
          <button onClick={startNew} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #8b5cf6, #d946ef)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            New Task
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length > 0 && (
            <>
              <div className="text-[10px] font-semibold text-[var(--muted-foreground)] px-3 py-2 uppercase tracking-widest">History</div>
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${conversationId === conv.id ? 'bg-white/5 text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:bg-white/[0.03] hover:text-[var(--foreground)]'}`}
                >
                  {conv.first_message || conv.title || 'New conversation'}
                </button>
              ))}
            </>
          )}
        </div>
        <div className="p-3 border-t border-white/5">
          <Link href="/agents" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/[0.03] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            Browse Agents
          </Link>
          <Link href="/agents/create" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/[0.03] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Publish Agent
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="flex-1 flex flex-col pt-16">
          {/* Mobile sidebar toggle */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed top-20 left-4 z-50 p-2 rounded-lg glass shadow-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6">
              {messages.length === 0 ? (
                /* ── Empty State ── */
                <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
                  {/* Animated orb */}
                  <div className="relative mb-6">
                    <div className="h-16 w-16 rounded-2xl orb-glow flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                      </svg>
                    </div>
                  </div>

                  <h1 className="text-3xl font-bold mb-3 text-center">
                    What can I help you <span className="gradient-text">create</span>?
                  </h1>
                  <p className="text-[var(--muted-foreground)] text-center max-w-md mb-8 text-sm leading-relaxed">
                    Describe your task and AgentNet will match you with the perfect AI agent — or handle it directly.
                  </p>

                  {/* Suggestion chips */}
                  <div className="grid sm:grid-cols-2 gap-2.5 w-full max-w-lg mb-8">
                    {suggestions.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => setInput(`${s.label} ${s.sub}`)}
                        className="chip-hover group flex items-start gap-3 p-3.5 rounded-xl border border-white/5 bg-white/[0.02] text-left"
                      >
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d={s.icon}/>
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[var(--foreground)]">{s.label}</div>
                          <div className="text-xs text-[var(--muted-foreground)] truncate">{s.sub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── Chat Messages ── */
                <div className="space-y-5">
                  {messages.map((msg, i) => (
                    <div key={i} className={`animate-msg-in flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="flex gap-3 max-w-[88%]">
                          {/* Avatar */}
                          <div className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(217, 70, 239, 0.1))' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                              <path d="M2 17l10 5 10-5"/>
                              <path d="M2 12l10 5 10-5"/>
                            </svg>
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="glass rounded-2xl rounded-tl-md px-4 py-3">
                              <div className="text-sm leading-relaxed text-[var(--foreground)]">
                                {msg.content.split('\n').map((line, j) => (
                                  <p key={j} className={j > 0 ? 'mt-2' : ''}>{line}</p>
                                ))}
                              </div>
                            </div>

                            {/* Agent suggestions */}
                            {msg.agents && msg.agents.length > 0 && !activeWorkId && (
                              <div className="mt-3 space-y-2">
                                {msg.agents.map((agent: any) => (
                                  <div key={agent.id} className="gradient-border p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                      <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg, #8b5cf6, #d946ef)' }}>
                                        {agent.name?.charAt(0)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-[var(--foreground)]">{agent.name}</div>
                                        <div className="text-xs text-[var(--muted-foreground)] font-mono">{agent.identity}</div>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs">
                                        <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                        <span className="text-[var(--muted-foreground)]">{Number(agent.rating).toFixed(1)}</span>
                                      </div>
                                    </div>
                                    {agent.skills && (
                                      <div className="flex flex-wrap gap-1.5 mb-3">
                                        {agent.skills.split(',').slice(0, 3).map((skill: string, si: number) => (
                                          <span key={si} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 text-[var(--muted-foreground)]">{skill.trim()}</span>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm">
                                        <span className="text-lg font-bold text-[var(--foreground)]">${Number(agent.price).toFixed(2)}</span>
                                        <span className="text-[var(--muted-foreground)] text-xs">/work</span>
                                      </div>
                                      <button
                                        onClick={() => handleHire(agent)}
                                        disabled={loading}
                                        className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #d946ef)' }}
                                      >
                                        Hire
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Work progress — timeline style */}
                            {msg.work && msg.work.id === activeWorkId && workStatus && workStatus !== 'COMPLETED' && workStatus !== 'FAILED' && (
                              <div className="mt-3 glass rounded-2xl p-4 overflow-hidden">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs font-mono text-[var(--muted-foreground)]">#{msg.work.work_number}</span>
                                  <span className="text-xs font-medium text-[#a78bfa] capitalize">{workStatus.toLowerCase()}</span>
                                </div>
                                {/* Progress bar */}
                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-3">
                                  <div className="h-full shimmer rounded-full transition-all duration-500" style={{
                                    width: workStatus === 'CREATED' ? '15%' : workStatus === 'ACCEPTED' ? '45%' : '75%',
                                  }} />
                                </div>
                                {/* Steps */}
                                <div className="flex items-center gap-2 text-[11px]">
                                  <div className={`flex items-center gap-1.5 ${workStatus !== 'CREATED' ? 'text-[var(--muted-foreground)]' : 'text-[#a78bfa]'}`}>
                                    <div className={`h-1.5 w-1.5 rounded-full ${workStatus === 'CREATED' ? 'bg-[#a78bfa]' : 'bg-[var(--success)]'}`} />
                                    Queued
                                  </div>
                                  <div className="h-px flex-1 bg-white/5" />
                                  <div className={`flex items-center gap-1.5 ${workStatus === 'CREATED' ? 'text-[var(--muted-foreground)]/50' : workStatus === 'ACCEPTED' ? 'text-[#a78bfa]' : 'text-[var(--muted-foreground)]'}`}>
                                    <div className={`h-1.5 w-1.5 rounded-full ${workStatus === 'ACCEPTED' ? 'bg-[#a78bfa]' : workStatus === 'WORKING' ? 'bg-[var(--success)]' : 'bg-white/10'}`} />
                                    Accepted
                                  </div>
                                  <div className="h-px flex-1 bg-white/5" />
                                  <div className={`flex items-center gap-1.5 ${workStatus === 'WORKING' ? 'text-[#a78bfa]' : 'text-[var(--muted-foreground)]/50'}`}>
                                    <div className={`h-1.5 w-1.5 rounded-full ${workStatus === 'WORKING' ? 'bg-[#a78bfa] animate-pulse' : 'bg-white/10'}`} />
                                    Generating
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Generated content — document style */}
                            {msg.workContent && (
                              <div className="mt-3 glass rounded-2xl overflow-hidden">
                                {/* Document header */}
                                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                                      <svg className="w-3.5 h-3.5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                    <span className="text-xs font-medium text-[var(--success)]">Delivered</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-[var(--muted-foreground)]">{msg.work?.agent_name}</span>
                                    <a
                                      href={`data:text/markdown;charset=utf-8,${encodeURIComponent(msg.workContent)}`}
                                      download={`${(msg.work?.work_number || 'output').toLowerCase()}.md`}
                                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                                      .md
                                    </a>
                                  </div>
                                </div>
                                {/* Document content */}
                                <div className="p-5 max-w-none">
                                  {msg.workContent.split('\n').map((line: string, j: number) => {
                                    if (line.startsWith('# ')) return <h1 key={j} className="text-xl font-bold mt-5 mb-2 text-[var(--foreground)]">{line.slice(2)}</h1>;
                                    if (line.startsWith('## ')) return <h2 key={j} className="text-base font-semibold mt-4 mb-2 text-[var(--foreground)]">{line.slice(3)}</h2>;
                                    if (line.startsWith('### ')) return <h3 key={j} className="text-sm font-semibold mt-3 mb-1 text-[var(--foreground)]">{line.slice(4)}</h3>;
                                    if (line.startsWith('- ') || line.startsWith('* ')) return <li key={j} className="ml-4 text-[var(--muted-foreground)] text-sm leading-relaxed list-disc">{line.slice(2)}</li>;
                                    if (line.trim() === '') return <div key={j} className="h-3" />;
                                    return <p key={j} className="text-sm text-[var(--muted-foreground)] leading-relaxed">{line}</p>;
                                  })}
                                </div>
                                {/* Rating footer */}
                                {msg.work && (
                                  <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
                                    <span className="text-xs text-[var(--muted-foreground)]">How was the result?</span>
                                    <div className="flex items-center gap-1">
                                      {[1,2,3,4,5].map(star => (
                                        <button
                                          key={star}
                                          onClick={() => handleRate(msg.work!.id, star)}
                                          className="text-base text-white/15 hover:text-amber-400 hover:scale-125 transition-all"
                                        >
                                          ★
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {msg.role === 'user' && (
                        <div className="max-w-[80%]">
                          <div
                            className="rounded-2xl rounded-br-md px-4 py-3 text-sm text-white leading-relaxed"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
                          >
                            {msg.content}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {loading && (
                    <div className="flex items-center gap-3 animate-fade-in">
                      <div className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(217, 70, 239, 0.1))' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                          <path d="M2 17l10 5 10-5"/>
                          <path d="M2 12l10 5 10-5"/>
                        </svg>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#a78bfa] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 rounded-full bg-[#a78bfa] animate-bounce" style={{ animationDelay: '120ms' }} />
                        <span className="h-2 w-2 rounded-full bg-[#a78bfa] animate-bounce" style={{ animationDelay: '240ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* ── Input bar ── */}
          <div className="border-t border-white/5 bg-[var(--background)]/60 backdrop-blur-xl">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <form onSubmit={handleSubmit} className="input-glass flex items-center gap-2 rounded-2xl glass px-3 py-2 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Describe your task..."
                  className="flex-1 bg-transparent text-sm text-[var(--foreground)] focus:outline-none placeholder:text-[var(--muted-foreground)]/60 px-2"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex items-center justify-center h-9 w-9 rounded-xl text-white transition-all hover:opacity-90 hover:scale-105 disabled:opacity-30 disabled:scale-100 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #d946ef)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 5l7 7-7 7"/>
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
