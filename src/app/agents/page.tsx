'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AgentCard from '@/components/AgentCard';

function AgentsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isMine = searchParams.get('mine') === 'true';
  const [agents, setAgents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAgents();
  }, [isMine]);

  const fetchAgents = async (q?: string) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (isMine) params.set('mine', 'true');
    if (q) params.set('q', q);
    const url = `/api/agents${params.toString() ? '?' + params.toString() : ''}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const errData = text ? JSON.parse(text) : null;
          if (errData?.error) message = errData.error;
        } catch { /* non-JSON error body — keep default message */ }
        throw new Error(message);
      }
      if (!text) throw new Error('Empty response from server — please retry.');
      const data = JSON.parse(text);
      setAgents(data.agents || []);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Request timed out. The database is slow to respond — please retry.');
      } else {
        setError(err?.message || 'Failed to load agents.');
      }
      setAgents([]);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAgents(search);
  };

  const handleToggleStatus = async (agent: any) => {
    const newStatus = agent.status === 'online' ? 'offline' : 'online';
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
        return;
      }
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a));
    } catch {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (agent: any) => {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete agent');
        return;
      }
      setAgents(prev => prev.filter(a => a.id !== agent.id));
    } catch {
      alert('Failed to delete agent');
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              {isMine ? (
                <>
                  <h1 className="text-3xl font-bold mb-2">My Agents</h1>
                  <p className="text-[var(--muted-foreground)]">Manage your published agents</p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl font-bold mb-2">Find an Agent</h1>
                  <p className="text-[var(--muted-foreground)]">Search by task, capability, or agent name</p>
                </>
              )}
            </div>
            <Link
              href="/agents/create"
              className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors shrink-0"
            >
              + Create Agent
            </Link>
          </div>

          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-3">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isMine ? "Search your agents..." : "Search: 'create a video', 'research company', 'build website'..."}
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {loading ? (
            <div className="text-center py-20 text-[var(--muted-foreground)]">Loading agents...</div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold mb-2">Couldn&apos;t load agents</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">{error}</p>
              <button
                onClick={() => fetchAgents(search || undefined)}
                className="inline-flex px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">{isMine ? '🤖' : '🔍'}</div>
              <h3 className="text-lg font-semibold mb-2">
                {isMine ? "You haven't created any agents yet" : 'No agents found'}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                {isMine ? 'Publish your first agent and start earning' : 'Try a different search term, or be the first to publish an agent'}
              </p>
              <Link href="/agents/create" className="inline-flex px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors">
                + Create Agent
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isOwner={isMine}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Loading...</div>}>
      <AgentsContent />
    </Suspense>
  );
}
