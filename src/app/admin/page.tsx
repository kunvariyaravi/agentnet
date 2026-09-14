'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import WorkStatus from '@/components/WorkStatus';
import Link from 'next/link';

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Loading analytics...</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Failed to load</div>;

  const o = data.overview;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-[var(--muted-foreground)] mb-8">Platform analytics and management</p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Users', value: o.total_users, icon: '👤' },
              { label: 'Agents', value: o.total_agents, icon: '🤖' },
              { label: 'Total Works', value: o.total_works, icon: '📋' },
              { label: 'Completed', value: o.completed_works, icon: '✅', color: 'text-emerald-400' },
              { label: 'Failed', value: o.failed_works, icon: '❌', color: 'text-red-400' },
              { label: 'Active', value: o.active_works, icon: '⚡', color: 'text-yellow-400' },
              { label: 'Revenue', value: `$${Number(o.total_revenue || 0).toFixed(2)}`, icon: '💰' },
              { label: 'Avg Rating', value: o.avg_rating ? Number(o.avg_rating).toFixed(2) : '—', icon: '⭐' },
              { label: 'Ratings', value: o.total_ratings, icon: '📊' },
              { label: 'Success Rate', value: o.total_works > 0 ? `${Math.round((o.completed_works / o.total_works) * 100)}%` : '—', icon: '📈' },
            ].map(stat => (
              <div key={stat.label} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{stat.icon}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">{stat.label}</span>
                </div>
                <div className={`text-2xl font-bold ${stat.color || ''}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Works Chart (simple bar visualization) */}
          {data.worksByDay && data.worksByDay.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 mb-8">
              <h2 className="font-semibold mb-4">Works (Last 30 Days)</h2>
              <div className="flex items-end gap-1 h-32">
                {data.worksByDay.map((d: any) => {
                  const maxCount = Math.max(...data.worksByDay.map((x: any) => x.count));
                  const height = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count} works`}>
                      <div className="text-[10px] text-[var(--muted-foreground)]">{d.count}</div>
                      <div
                        className="w-full rounded-t bg-[var(--primary)]/60 hover:bg-[var(--primary)] transition-colors"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-[var(--muted-foreground)]">
                <span>{data.worksByDay[0]?.day}</span>
                <span>{data.worksByDay[data.worksByDay.length - 1]?.day}</span>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Top Agents */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="font-semibold mb-4">Top Agents by Volume</h2>
              <div className="space-y-3">
                {data.topAgents.map((agent: any, i: number) => (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted-foreground)] w-4">#{i + 1}</span>
                      <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-semibold text-xs">
                        {agent.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{agent.name}</div>
                        <div className="text-xs text-[var(--muted-foreground)] font-mono">{agent.identity}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--muted-foreground)]">
                      <div>{agent.completed_works || 0} works</div>
                      <div className="flex items-center gap-1 text-yellow-400">
                        ⭐ {Number(agent.avg_rating || 0).toFixed(2)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Top Capabilities */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="font-semibold mb-4">Top Capabilities</h2>
              {data.topCapabilities.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No capability data yet</p>
              ) : (
                <div className="space-y-3">
                  {data.topCapabilities.map((cap: any) => (
                    <div key={cap.name} className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)]">
                      <div>
                        <div className="text-sm font-medium">{cap.name}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{cap.work_count} works</div>
                      </div>
                      {cap.avg_rating && (
                        <div className="flex items-center gap-1 text-xs text-yellow-400">
                          ⭐ {Number(cap.avg_rating).toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Works */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="font-semibold mb-4">Recent Works</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--muted-foreground)] border-b border-[var(--border)]">
                    <th className="pb-2 font-medium">Work</th>
                    <th className="pb-2 font-medium">Requester</th>
                    <th className="pb-2 font-medium">Agent</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Price</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {data.recentWorks.map((work: any) => (
                    <tr key={work.id} className="hover:bg-[var(--secondary)]/50">
                      <td className="py-3">
                        <Link href={`/works/${work.work_number}`} className="font-mono text-xs text-[var(--primary)] hover:underline">
                          #{work.work_number}
                        </Link>
                        <div className="text-xs text-[var(--muted-foreground)] max-w-[200px] truncate">{work.title}</div>
                      </td>
                      <td className="py-3 text-xs text-[var(--muted-foreground)]">{work.requester_name}</td>
                      <td className="py-3">
                        <span className="text-xs font-mono">{work.agent_identity}</span>
                      </td>
                      <td className="py-3"><WorkStatus status={work.status} /></td>
                      <td className="py-3 text-xs">${Number(work.price || 0).toFixed(2)}</td>
                      <td className="py-3 text-xs text-[var(--muted-foreground)]">{new Date(work.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
