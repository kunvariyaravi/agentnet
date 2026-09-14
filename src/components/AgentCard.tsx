'use client';

import Link from 'next/link';
import { useState } from 'react';

interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    identity: string;
    description?: string;
    avg_rating?: number;
    completed_works?: number;
    success_rate?: number;
    price?: number;
    avg_delivery_minutes?: number;
    skill_names?: string;
    status?: string;
    agent_type?: string;
  };
  showHire?: boolean;
  onHire?: (agent: any) => void;
  isOwner?: boolean;
  onToggleStatus?: (agent: any) => void;
  onDelete?: (agent: any) => void;
}

export default function AgentCard({ agent, showHire = true, onHire, isOwner = false, onToggleStatus, onDelete }: AgentCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const skills = agent.skill_names ? agent.skill_names.split(',') : [];
  const rating = agent.avg_rating ? Number(agent.avg_rating).toFixed(2) : '0.00';
  const works = agent.completed_works || 0;
  const success = agent.success_rate ? Math.round(Number(agent.success_rate) * 100) : 0;
  const isOnline = agent.status === 'online';

  const statusColors = isOnline
    ? 'text-[var(--success)]'
    : agent.status === 'maintenance'
    ? 'text-yellow-400'
    : 'text-[var(--muted-foreground)]';

  const statusDot = isOnline
    ? 'bg-[var(--success)] animate-pulse-dot'
    : agent.status === 'maintenance'
    ? 'bg-yellow-400'
    : 'bg-[var(--muted-foreground)]';

  return (
    <div className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition-all hover:border-[var(--primary)]/50 hover:shadow-lg hover:shadow-[var(--primary)]/5 relative">
      {/* Delete confirmation overlay */}
      {confirmingDelete && (
        <div className="absolute inset-0 z-10 rounded-xl bg-[var(--card)]/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-sm font-semibold mb-1">Delete {agent.name}?</p>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setConfirmingDelete(false); onDelete?.(agent); }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <Link href={`/agents/${agent.id}`} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] font-semibold text-sm">
            {agent.name?.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
              {agent.name}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] font-mono">{agent.identity}</p>
          </div>
        </Link>
        <span className={`flex items-center gap-1.5 text-xs ${statusColors} shrink-0`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          <span className="capitalize">{agent.status || 'offline'}</span>
        </span>
      </div>

      <p className="text-sm text-[var(--muted-foreground)] mb-4 line-clamp-2">{agent.description}</p>

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {skills.slice(0, 3).map((skill: string) => (
            <span key={skill} className="px-2 py-0.5 text-xs rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
              {skill.trim()}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)] mb-4">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          {rating}
        </span>
        <span>{works.toLocaleString()} works</span>
        <span>{success}% success</span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
        <div className="text-sm">
          <span className="font-semibold text-[var(--foreground)]">
            {agent.price === 0 ? 'Free' : `$${Number(agent.price).toFixed(2)}`}
          </span>
          {agent.price !== 0 && <span className="text-[var(--muted-foreground)]">/work</span>}
        </div>
        {!isOwner && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">
              ~{agent.avg_delivery_minutes || 5} min
            </span>
            {showHire && (
              onHire ? (
                <button
                  onClick={() => onHire(agent)}
                  className="px-3 py-1.5 text-xs font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors"
                >
                  Hire {agent.name}
                </button>
              ) : (
                <Link
                  href={`/agents/${agent.id}`}
                  className="px-3 py-1.5 text-xs font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors"
                >
                  Hire {agent.name}
                </Link>
              )
            )}
          </div>
        )}
      </div>

      {/* Owner action buttons */}
      {isOwner && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border)]">
          <Link
            href={`/agents/${agent.id}/edit`}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </Link>
          <button
            onClick={() => onToggleStatus?.(agent)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isOnline
                ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isOnline
                ? <path d="M18.36 6.64a9 9 0 11-12.72 0 M12 2v10"/>
                : <path d="M5.64 18.36a9 9 0 1012.72 0 M12 22V12"/>}
            </svg>
            {isOnline ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
