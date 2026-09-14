'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import RatingStars from '@/components/RatingStars';
import WorkStatus from '@/components/WorkStatus';
import Link from 'next/link';

export default function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [agent, setAgent] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [recentWorks, setRecentWorks] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hiring, setHiring] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showHireModal, setShowHireModal] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');
  const [toggling, setToggling] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'reviews'>('overview');
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch(`/api/agents/${id}`).then(r => r.json()),
      fetch(`/api/agents/${id}/analytics`).then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ]).then(([agentData, analyticsData, userRes]) => {
      setAgent(agentData.agent);
      setSkills(agentData.skills || []);
      setReviews(agentData.reviews || []);
      setRecentWorks(agentData.recentWorks || []);
      setAnalytics(analyticsData);
      setCurrentUser(userRes.user || null);
      setLoading(false);
    });
  }, [id]);

  const isOwner = currentUser && agent && (currentUser.id === agent.owner_id || currentUser.role === 'admin');

  const handleToggleStatus = async () => {
    setToggling(true);
    const newStatus = agent.status === 'online' ? 'offline' : 'online';
    try {
      await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      setAgent({ ...agent, status: newStatus });
    } catch {
      alert('Failed to update status');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/agents');
    } catch (err: any) {
      alert(err.message || 'Failed to delete agent');
    }
  };

  const handleHire = async () => {
    if (!taskDescription.trim()) return;
    setHiring(true);
    try {
      const res = await fetch('/api/works', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          agent_id: agent.id,
          title: taskDescription.slice(0, 200),
          description: taskDescription,
          price: agent.price,
        }),
      });
      const data = await res.json();
      setShowHireModal(false);
      setTaskDescription('');

      // Trigger status transitions: CREATED -> ACCEPTED -> WORKING
      await fetch(`/api/works/${data.work.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });

      setTimeout(async () => {
        await fetch(`/api/works/${data.work.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'WORKING' }),
        });
      }, 1000);

      router.push(`/workspace?work=${data.work.work_number}`);
    } catch {
      alert('Failed to hire agent');
    } finally {
      setHiring(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Loading...</div>;
  if (!agent) return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Agent not found</div>;

  const rep = agent;
  const rating = rep.avg_rating ? Number(rep.avg_rating).toFixed(2) : '0.00';
  const success = rep.success_rate ? Math.round(Number(rep.success_rate) * 100) : 0;
  const a = analytics?.stats || {};
  const r = analytics?.ratingStats || {};

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
            <div className="h-20 w-20 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-3xl font-bold shrink-0">
              {agent.name?.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold">{agent.name}</h1>
                <span className={`flex items-center gap-1.5 text-xs ${agent.status === 'online' ? 'text-[var(--success)]' : agent.status === 'maintenance' ? 'text-yellow-400' : 'text-[var(--muted-foreground)]'}`}>
                  <span className={`h-2 w-2 rounded-full ${agent.status === 'online' ? 'bg-[var(--success)] animate-pulse-dot' : agent.status === 'maintenance' ? 'bg-yellow-400' : 'bg-[var(--muted-foreground)]'}`} />
                  <span className="capitalize">{agent.status}</span>
                </span>
              </div>
              <p className="text-[var(--muted-foreground)] font-mono mb-3">{agent.identity}</p>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">{agent.description}</p>
              <div className="flex items-center gap-6 text-sm flex-wrap">
                <div className="flex items-center gap-1.5">
                  <RatingStars rating={Number(rating)} readonly size="sm" />
                  <span className="font-semibold">{rating}</span>
                  <span className="text-[var(--muted-foreground)]">/ 5</span>
                </div>
                <span className="text-[var(--muted-foreground)]">{(rep.completed_works || 0).toLocaleString()} works</span>
                <span className="text-[var(--muted-foreground)]">{success}% success</span>
                <span className="text-[var(--muted-foreground)]">{a.active || 0} active</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => setShowHireModal(true)}
                disabled={hiring || agent.status !== 'online'}
                className="px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50"
              >
                {hiring ? 'Hiring...' : `Hire ${agent.name}`}
              </button>
              <div className="text-center text-sm">
                <span className="font-semibold">${Number(agent.price).toFixed(2)}</span>
                <span className="text-[var(--muted-foreground)]">/work</span>
                <span className="text-[var(--muted-foreground)] ml-2">~{agent.avg_delivery_minutes} min</span>
              </div>

              {/* Owner controls */}
              {isOwner && (
                <div className="flex gap-2 pt-2 mt-2 border-t border-[var(--border)]">
                  <Link
                    href={`/agents/${id}/edit`}
                    className="flex-1 px-3 py-2 text-xs font-medium text-center rounded-lg border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={handleToggleStatus}
                    disabled={toggling}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                      agent.status === 'online'
                        ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    }`}
                  >
                    {toggling ? '...' : agent.status === 'online' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => setShowDelete(true)}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
            {(['overview', 'analytics', 'reviews'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-[var(--primary)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                <h2 className="text-lg font-semibold mb-4">Capabilities</h2>
                <div className="space-y-3">
                  {skills.map((skill: any) => (
                    <div key={skill.id} className="p-3 rounded-lg bg-[var(--secondary)]">
                      <div className="font-medium text-sm mb-1">{skill.name}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{skill.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                  <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Total Works</div>
                      <div className="text-xl font-bold">{a.total_works || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Avg Delivery</div>
                      <div className="text-xl font-bold">{a.avg_delivery_minutes ? `${Math.round(a.avg_delivery_minutes)}m` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Revenue</div>
                      <div className="text-xl font-bold">${Number(a.total_revenue || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Rated Works</div>
                      <div className="text-xl font-bold">{r.total_rated || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                  <h2 className="text-lg font-semibold mb-4">Recent Work</h2>
                  {recentWorks.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">No completed works yet</p>
                  ) : (
                    <div className="space-y-2">
                      {recentWorks.map((work: any) => (
                        <Link key={work.id} href={`/works/${work.work_number}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 transition-colors">
                          <div>
                            <div className="text-sm font-medium">{work.title?.slice(0, 40)}</div>
                            <div className="text-xs text-[var(--muted-foreground)]">#{work.work_number}</div>
                          </div>
                          <WorkStatus status={work.status} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Dimension Ratings */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                <h2 className="text-lg font-semibold mb-4">Rating Dimensions</h2>
                <div className="space-y-4">
                  {[
                    { label: 'Overall', value: r.avg_rating, max: 5 },
                    { label: 'Quality', value: r.avg_quality, max: 5 },
                    { label: 'Reliability', value: r.avg_reliability, max: 5 },
                    { label: 'Speed', value: r.avg_speed, max: 5 },
                    { label: 'Value', value: r.avg_value, max: 5 },
                  ].map(dim => (
                    <div key={dim.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{dim.label}</span>
                        <span className="text-[var(--muted-foreground)]">{dim.value ? Number(dim.value).toFixed(1) : '—'} / {dim.max}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--secondary)]">
                        <div
                          className="h-full rounded-full bg-[var(--primary)] transition-all"
                          style={{ width: `${dim.value ? (Number(dim.value) / dim.max) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Activity */}
              {analytics?.dailyWorks?.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                  <h2 className="text-lg font-semibold mb-4">Activity (30 Days)</h2>
                  <div className="flex items-end gap-1 h-24">
                    {analytics.dailyWorks.map((d: any) => {
                      const max = Math.max(...analytics.dailyWorks.map((x: any) => x.count));
                      const h = max > 0 ? (d.count / max) * 100 : 0;
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center" title={`${d.day}: ${d.count}`}>
                          <div className="w-full rounded-t bg-[var(--primary)]/60" style={{ height: `${Math.max(h, 4)}%` }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Work Outcomes */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
                  <div className="text-3xl font-bold text-[var(--success)]">{a.completed || 0}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Completed</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
                  <div className="text-3xl font-bold text-red-400">{a.failed || 0}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Failed</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
                  <div className="text-3xl font-bold text-yellow-400">{a.active || 0}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Active</div>
                </div>
              </div>
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">💬</div>
                  <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">Reviews appear here after completed work</p>
                </div>
              ) : (
                reviews.map((review: any) => (
                  <div key={review.id} className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[var(--secondary)] flex items-center justify-center text-sm font-medium">
                          {review.reviewer_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{review.reviewer_name}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">Work #{review.work_number}</div>
                        </div>
                      </div>
                      <RatingStars rating={review.score || 0} readonly size="sm" />
                    </div>
                    {review.title && <div className="font-medium text-sm mb-1">{review.title}</div>}
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{review.content}</p>
                    <div className="text-xs text-[var(--muted-foreground)] mt-2">{new Date(review.created_at).toLocaleDateString()}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Hire task input modal */}
      {showHireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowHireModal(false)}>
          <div className="mx-4 max-w-lg w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Hire {agent.name}</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Describe your task. {agent.name} will use this as the prompt to generate your output.
            </p>
            <textarea
              value={taskDescription}
              onChange={e => setTaskDescription(e.target.value)}
              placeholder="e.g., Write a well-structured blog post about AI in healthcare. Include an introduction, 3-4 main sections with headers, and a conclusion."
              rows={5}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent placeholder:text-[var(--muted-foreground)] mb-4"
            />
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[var(--muted-foreground)]">
                <span className="font-semibold text-[var(--foreground)]">${Number(agent.price).toFixed(2)}</span> /work
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">{taskDescription.length} chars</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowHireModal(false); setTaskDescription(''); }}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border)] font-medium text-sm hover:bg-[var(--secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleHire}
                disabled={hiring || !taskDescription.trim()}
                className="flex-1 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium text-sm hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50"
              >
                {hiring ? 'Creating work...' : `Hire for $${Number(agent.price).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDelete(false)}>
          <div className="mx-4 max-w-md w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Delete this agent?</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">
              This will permanently remove <strong className="text-[var(--foreground)]">{agent.name}</strong> ({agent.identity}) and all its data.
            </p>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              This includes skills, reputation data, and delegation records. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border)] font-medium text-sm hover:bg-[var(--secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
              >
                Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
