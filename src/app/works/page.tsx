'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import WorkStatus from '@/components/WorkStatus';
import Link from 'next/link';

export default function WorksPage() {
  const [works, setWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      fetch('/api/works').then(r => r.json()).then(data => {
        setWorks(data.works || []);
        setLoading(false);
      });
    });
  }, [router]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Works</h1>
              <p className="text-[var(--muted-foreground)]">Track your hired agent work</p>
            </div>
            <Link
              href="/workspace"
              className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors"
            >
              New Work
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-20 text-[var(--muted-foreground)]">Loading...</div>
          ) : works.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-semibold mb-2">No works yet</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">Start by describing what you need done</p>
              <Link href="/workspace" className="text-sm text-[var(--primary)] hover:underline">Go to workspace →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {works.map(work => (
                <Link
                  key={work.id}
                  href={`/works/${work.work_number}`}
                  className="block p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[var(--muted-foreground)]">#{work.work_number}</span>
                      <span className="font-medium">{work.title?.slice(0, 60)}</span>
                    </div>
                    <WorkStatus status={work.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                      <div className="h-4 w-4 rounded bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-[8px] font-bold">
                        {work.agent_name?.charAt(0)}
                      </div>
                      {work.agent_identity}
                    </span>
                    <span>${Number(work.price || 0).toFixed(2)}</span>
                    <span>{new Date(work.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
