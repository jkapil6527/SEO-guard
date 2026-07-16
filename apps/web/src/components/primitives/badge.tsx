'use client';

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { Severity } from '@/lib/types';

/**
 * Severity is never colour-only (WCAG 1.4.1): every badge carries a shape marker
 * plus the label. Colours come from the token layer, so badges and charts can
 * never drift apart.
 */
const SEVERITY: Record<Severity, string> = {
  critical: 'text-critical bg-critical/10 border-critical/25',
  high: 'text-high bg-high/10 border-high/25',
  medium: 'text-medium bg-medium/10 border-medium/25',
  low: 'text-low bg-low/10 border-low/25',
  info: 'text-info bg-info/10 border-info/25',
};

const base =
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap';

export function SeverityBadge({ severity }: { severity: string }) {
  const key = (severity in SEVERITY ? severity : 'info') as Severity;
  return (
    <span className={cn(base, SEVERITY[key], 'capitalize')}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {key}
    </span>
  );
}

/** Crawl lifecycle status. Kept separate from severity — they are different axes. */
const STATUS: Record<string, string> = {
  queued: 'text-muted bg-surface-hover border-border',
  resolving: 'text-low bg-low/10 border-low/25',
  running: 'text-primary bg-primary-soft border-primary/25',
  paused: 'text-medium bg-medium/10 border-medium/25',
  finalizing: 'text-primary bg-primary-soft border-primary/25',
  completed: 'text-success bg-success-soft border-success/25',
  failed: 'text-critical bg-critical/10 border-critical/25',
  cancelled: 'text-muted bg-surface-hover border-border',
};

export function StatusBadge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span className={cn(base, STATUS[status] ?? STATUS.queued, 'capitalize')}>
      {children ?? status}
    </span>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Health/SEO score, coloured by band. */
export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || Number.isNaN(score)) {
    return <span className="text-faint">—</span>;
  }
  const tone =
    score >= 90 ? 'text-success' : score >= 70 ? 'text-warning' : 'text-danger';
  return <span className={cn('font-semibold tabular-nums', tone)}>{Math.round(score)}</span>;
}
