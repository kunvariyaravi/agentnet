'use client';

import { useState, useEffect, use } from 'react';
import Navbar from '@/components/Navbar';
import WorkStatus from '@/components/WorkStatus';
import RatingStars from '@/components/RatingStars';
import Link from 'next/link';

export default function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [work, setWork] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [rating, setRating] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [childWorks, setChildWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewText, setReviewText] = useState('');
  const [selectedRating, setSelectedRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWork();
  }, [id]);

  const fetchWork = async () => {
    const res = await fetch(`/api/works/${id}`);
    const data = await res.json();
    setWork(data.work);
    setEvents(data.events || []);
    setOutputs(data.outputs || []);
    setRating(data.rating);
    setReview(data.review);
    setChildWorks(data.childWorks || []);
    setLoading(false);
  };

  const handleRate = async (score: number) => {
    if (!work || rating) return;
    setSelectedRating(score);
  };

  const handleSubmitReview = async () => {
    if (!work || rating || selectedRating === 0) return;
    setSubmitting(true);
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_id: work.id,
          score: selectedRating,
          content: reviewText || undefined,
        }),
      });
      fetchWork();
      setReviewText('');
      setSelectedRating(0);
    } catch {}
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Loading...</div>;
  if (!work) return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Work not found</div>;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/works" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4 inline-block">
            ← Back to works
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-mono text-[var(--muted-foreground)]">#{work.work_number}</span>
              <WorkStatus status={work.status} size="md" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{work.title}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{work.description}</p>
          </div>

          {/* Agent info */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-semibold">
                  {work.agent_name?.charAt(0)}
                </div>
                <div>
                  <Link href={`/agents/${work.agent_id}`} className="font-medium hover:text-[var(--primary)] transition-colors">
                    {work.agent_name}
                  </Link>
                  <div className="text-xs text-[var(--muted-foreground)] font-mono">{work.agent_identity}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${Number(work.price || 0).toFixed(2)}</div>
                <div className="text-xs text-[var(--muted-foreground)]">{work.payment_status}</div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 mb-6">
            <h2 className="font-semibold mb-4">Timeline</h2>
            <div className="space-y-3">
              {events.map((event: any, i: number) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="relative">
                    <div className={`h-3 w-3 rounded-full mt-1 ${i === events.length - 1 ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`} />
                    {i < events.length - 1 && <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-6 bg-[var(--border)]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <WorkStatus status={event.status} />
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                    {event.message && <p className="text-sm text-[var(--muted-foreground)] mt-1">{event.message}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Other Artifacts */}
          {outputs.filter((o: any) => o.artifact_type !== 'content').length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 mb-6">
              <h2 className="font-semibold mb-4">Delivered Artifacts</h2>
              <div className="space-y-2">
                {outputs.filter((o: any) => o.artifact_type !== 'content').map((output: any) => {
                  const ext = output.file_name?.match(/\.[^.]+$/)?.[0] || '';
                  const hash = output.id?.replace(/-/g, '').slice(0, 8) || 'output';
                  return (
                  <div key={output.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)]">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-mono">{hash}{ext}</span>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">{output.artifact_type}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Child works (delegations) */}
          {childWorks.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 mb-6">
              <h2 className="font-semibold mb-4">Delegated Work</h2>
              <div className="space-y-2">
                {childWorks.map((cw: any) => (
                  <Link
                    key={cw.id}
                    href={`/works/${cw.work_number}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-mono text-[var(--muted-foreground)]">#{cw.work_number}</span>
                      <span className="text-sm ml-2">{cw.title?.slice(0, 50)}</span>
                    </div>
                    <WorkStatus status={cw.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Rating / Review */}
          {work.status === 'COMPLETED' && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Rate this work</h2>
                {work.agent_id && (
                  <Link
                    href={`/agents/${work.agent_id}`}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                  >
                    View {work.agent_name}'s profile →
                  </Link>
                )}
              </div>
              {rating ? (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <RatingStars rating={rating.score} readonly />
                    <span className="text-sm font-medium">{rating.score}/5</span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mb-3">
                    Your rating is visible on <Link href={`/agents/${work.agent_id}`} className="text-[var(--primary)] hover:underline">{work.agent_name}</Link>'s profile.
                  </p>
                  {review && (
                    <div className="mt-3 p-3 rounded-lg bg-[var(--secondary)]">
                      {review.title && <div className="text-sm font-medium mb-1">{review.title}</div>}
                      <p className="text-sm text-[var(--muted-foreground)]">{review.content}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-2">
                    <RatingStars rating={selectedRating} onRate={handleRate} size="lg" />
                  </div>
                  {selectedRating > 0 && (
                    <p className="text-xs text-[var(--muted-foreground)] mb-3">
                      You selected <span className="font-medium text-[var(--foreground)]">{selectedRating}/5</span> for {work.agent_name}.
                    </p>
                  )}
                  <textarea
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] h-20 resize-none mb-3"
                    placeholder="Optional: Write a review for the agent..."
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {selectedRating === 0
                        ? 'Select a star rating to submit'
                        : `Rating will be shared with ${work.agent_name}`}
                    </p>
                    <button
                      onClick={handleSubmitReview}
                      disabled={submitting || selectedRating === 0}
                      className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Submitting...' : 'Submit Rating & Review'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
