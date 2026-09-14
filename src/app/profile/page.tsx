'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import WorkStatus from '@/components/WorkStatus';
import RatingStars from '@/components/RatingStars';

export default function ProfilePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'works' | 'reviews'>('overview');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/user/profile').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      setData(d);
      setLoading(false);
    });
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Loading...</div>;
  if (!data) return null;

  const { user, agents, works, reviews, stats } = data;
  const isProvider = agents.length > 0;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start gap-6 mb-8">
            <div className="h-20 w-20 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-3xl font-bold shrink-0">
              {user.name?.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-1">{user.name}</h1>
              <p className="text-[var(--muted-foreground)] text-sm mb-2">{user.email}</p>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
                  {isProvider ? '🤖 Agent Provider' : '👤 Agent User'}
                </span>
                {user.role === 'admin' && (
                  <span className="px-2.5 py-0.5 text-xs rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                    Admin
                  </span>
                )}
                <span className="text-xs text-[var(--muted-foreground)]">
                  Member since {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <Link href="/agents/create" className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors">
              + Create Agent
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Works Hired', value: stats.totalWorks, icon: '📋' },
              { label: 'Completed', value: stats.completedWorks, icon: '✅', color: 'text-[var(--success)]' },
              { label: 'Total Spent', value: `$${stats.totalSpent.toFixed(2)}`, icon: '💰' },
              { label: 'Agents Created', value: stats.agentsCreated, icon: '🤖' },
              { label: 'Reviews Given', value: stats.reviewsGiven, icon: '⭐' },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="flex items-center gap-2 mb-1">
                  <span>{s.icon}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">{s.label}</span>
                </div>
                <div className={`text-xl font-bold ${s.color || ''}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
            {(['overview', 'agents', 'works', 'reviews'] as const).map(tab => (
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
            <div className="space-y-6">
              {/* Quick actions */}
              <div className="grid sm:grid-cols-3 gap-4">
                <Link href="/workspace" className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 transition-colors">
                  <div className="text-2xl mb-2">💬</div>
                  <div className="font-semibold text-sm">New Work</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Describe a task and hire an agent</div>
                </Link>
                <Link href="/agents" className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 transition-colors">
                  <div className="text-2xl mb-2">🔍</div>
                  <div className="font-semibold text-sm">Find Agents</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Search by task or capability</div>
                </Link>
                <Link href="/agents/create" className="p-5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 transition-colors">
                  <div className="text-2xl mb-2">➕</div>
                  <div className="font-semibold text-sm">Create Agent</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Publish your AI agent</div>
                </Link>
              </div>

              {/* Recent activity */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                <h2 className="font-semibold mb-4">Recent Activity</h2>
                {works.length === 0 && agents.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-3">🚀</div>
                    <p className="text-sm text-[var(--muted-foreground)]">No activity yet. Start by describing a task or creating an agent.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {works.slice(0, 5).map((w: any) => (
                      <Link key={w.id} href={`/works/${w.work_number}`} className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-[var(--muted-foreground)]">#{w.work_number}</span>
                          <span className="text-sm">{w.title?.slice(0, 40)}</span>
                        </div>
                        <WorkStatus status={w.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* My agents */}
              {agents.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                  <h2 className="font-semibold mb-4">My Agents</h2>
                  <div className="space-y-3">
                    {agents.map((a: any) => (
                      <Link key={a.id} href={`/agents/${a.id}`} className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-semibold text-xs">{a.name?.charAt(0)}</div>
                          <div>
                            <div className="text-sm font-medium">{a.name}</div>
                            <div className="text-xs text-[var(--muted-foreground)] font-mono">{a.identity}</div>
                          </div>
                        </div>
                        <div className="text-right text-xs text-[var(--muted-foreground)]">
                          <div className="flex items-center gap-1 text-yellow-400">⭐ {Number(a.avg_rating || 0).toFixed(2)}</div>
                          <div>{a.completed_works || 0} works</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-4">
              {agents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🤖</div>
                  <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
                  <p className="text-sm text-[var(--muted-foreground)] mb-4">Create your first agent and start earning</p>
                  <Link href="/agents/create" className="inline-flex px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors">
                    + Create Agent
                  </Link>
                </div>
              ) : (
                agents.map((a: any) => (
                  <Link key={a.id} href={`/agents/${a.id}`} className="block p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-lg">{a.name?.charAt(0)}</div>
                        <div>
                          <div className="font-semibold">{a.name}</div>
                          <div className="text-sm text-[var(--muted-foreground)] font-mono">{a.identity}</div>
                          <div className="text-xs text-[var(--muted-foreground)] mt-1">{a.description?.slice(0, 80)}...</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-yellow-400 text-sm">⭐ {Number(a.avg_rating || 0).toFixed(2)}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{a.completed_works || 0} works</div>
                        <div className="text-sm font-semibold mt-1">${Number(a.price).toFixed(2)}/work</div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {/* Works Tab */}
          {activeTab === 'works' && (
            <div className="space-y-3">
              {works.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📋</div>
                  <h3 className="text-lg font-semibold mb-2">No works yet</h3>
                  <p className="text-sm text-[var(--muted-foreground)] mb-4">Hire an agent to get your first work done</p>
                  <Link href="/workspace" className="inline-flex px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors">
                    Start Working
                  </Link>
                </div>
              ) : (
                works.map((w: any) => (
                  <Link key={w.id} href={`/works/${w.work_number}`} className="block p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-[var(--muted-foreground)]">#{w.work_number}</span>
                        <span className="font-medium text-sm">{w.title?.slice(0, 50)}</span>
                      </div>
                      <WorkStatus status={w.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                      <span>{w.agent_identity}</span>
                      <span>${Number(w.price || 0).toFixed(2)}</span>
                      <span>{new Date(w.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">⭐</div>
                  <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">Reviews appear after you complete work with an agent</p>
                </div>
              ) : (
                reviews.map((r: any) => (
                  <div key={r.id} className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-[var(--muted-foreground)]">#{r.work_number}</span>
                        <span className="text-sm font-medium">{r.agent_name}</span>
                      </div>
                      <RatingStars rating={r.score} readonly size="sm" />
                    </div>
                    {r.title && <div className="font-medium text-sm mb-1">{r.title}</div>}
                    <p className="text-sm text-[var(--muted-foreground)]">{r.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
