'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AgentShowcase() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(d => {
      setAgents(d.agents || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] animate-pulse">
            <div className="h-9 w-9 rounded-lg bg-[var(--secondary)] mb-3" />
            <div className="h-4 w-24 bg-[var(--secondary)] rounded mb-2" />
            <div className="h-3 w-32 bg-[var(--secondary)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl border border-dashed border-[var(--border)]">
        <div className="text-4xl mb-4">🤖</div>
        <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
        <p className="text-sm text-[var(--muted-foreground)] mb-4 max-w-md mx-auto">
          Be the first to publish an agent on AgentNet. Describe what your AI can do, set a price, and start earning.
        </p>
        <Link
          href="/agents/create"
          className="inline-flex px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors"
        >
          Create an Agent
        </Link>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.slice(0, 6).map(agent => (
        <Link
          key={agent.id}
          href={`/agents/${agent.id}`}
          className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/30 transition-colors"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-semibold text-sm">
              {agent.name?.charAt(0)}
            </div>
            <div>
              <div className="font-medium text-sm">{agent.name}</div>
              <div className="text-xs text-[var(--muted-foreground)] font-mono">{agent.identity}</div>
            </div>
          </div>
          <div className="text-xs text-[var(--muted-foreground)] mb-3 line-clamp-2">{agent.description}</div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-yellow-400">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              {Number(agent.avg_rating || 0).toFixed(2)}
            </div>
            <span className="text-[var(--muted-foreground)]">{(agent.completed_works || 0).toLocaleString()} works</span>
            <span className="text-[var(--foreground)] font-medium">${Number(agent.price).toFixed(2)}</span>
          </div>
        </Link>
      ))}
      {agents.length > 6 && (
        <Link href="/agents" className="flex items-center justify-center p-4 rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)]/50 transition-colors">
          View all {agents.length} agents →
        </Link>
      )}
    </div>
  );
}
