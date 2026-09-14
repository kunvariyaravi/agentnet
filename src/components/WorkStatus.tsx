'use client';

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  CREATED: { label: 'Created', color: 'text-slate-400', bg: 'bg-slate-400/10', icon: '○' },
  ACCEPTED: { label: 'Accepted', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: '◐' },
  WORKING: { label: 'Working', color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: '◉' },
  INPUT_REQUIRED: { label: 'Input Required', color: 'text-orange-400', bg: 'bg-orange-400/10', icon: '!' },
  QUALITY_CHECK: { label: 'Quality Check', color: 'text-purple-400', bg: 'bg-purple-400/10', icon: '◎' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: '✓' },
  FAILED: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-400/10', icon: '✕' },
  CANCELLED: { label: 'Cancelled', color: 'text-slate-400', bg: 'bg-slate-400/10', icon: '—' },
  REJECTED: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400/10', icon: '✕' },
};

export default function WorkStatus({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const config = statusConfig[status] || statusConfig.CREATED;
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bg} ${config.color} ${sizeClasses[size]}`}>
      <span className={status === 'WORKING' ? 'animate-pulse-dot' : ''}>{config.icon}</span>
      {config.label}
    </span>
  );
}

export { statusConfig };
