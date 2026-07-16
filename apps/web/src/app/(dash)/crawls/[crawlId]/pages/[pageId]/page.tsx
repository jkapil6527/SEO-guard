'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { usePageReport, usePageSchema } from '@/features/reports/api';
import { IssueCard } from '@/features/reports/issue-card';
import { SchemaCard } from '@/features/reports/schema-card';
import { QueryBoundary, EmptyState } from '@/components/feedback/query-boundary';
import { Skeleton } from '@/components/primitives/skeleton';
import { HealthGauge } from '@/components/charts/charts';
import { StatusBadge } from '@/components/primitives/badge';
import { cn } from '@/utils/cn';
import type { IssueDetail, Severity } from '@/lib/types';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

/**
 * The URL report. Every finding says WHERE it is on the page — the exact
 * element, its markup, or (for duplicates) the other URLs it collides with.
 */
export default function UrlReportPage() {
  const params = useParams<{ crawlId: string; pageId: string }>();
  const report = usePageReport(params.crawlId, params.pageId);
  const schema = usePageSchema(params.crawlId, params.pageId);
  const [severity, setSeverity] = useState<Severity | 'all'>('all');

  return (
    <QueryBoundary
      query={report}
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      }
    >
      {({ snapshot, issues }) => {
        const counts = SEVERITIES.map((s) => ({
          severity: s,
          count: issues.filter((i) => i.severity === s).length,
        }));
        const shown =
          severity === 'all' ? issues : issues.filter((i: IssueDetail) => i.severity === severity);
        const score = snapshot.score === null ? null : Number(snapshot.score);
        const entities = schema.data?.data ?? [];

        return (
          <div className="space-y-6">
            {/* Sticky summary — the URL, its scores and status, always visible. */}
            <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
              <div className="flex flex-wrap items-center gap-4">
                <HealthGauge score={score} size={56} />
                <div className="min-w-0 flex-1">
                  <a
                    href={snapshot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-mono text-sm text-text hover:text-primary"
                  >
                    {snapshot.url}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <StatusBadge status={snapshot.fetchStatus}>
                      HTTP {snapshot.httpStatus ?? '—'}
                    </StatusBadge>
                    <span>{issues.length} issues</span>
                    {snapshot.rendered && <span>JS-rendered</span>}
                    <span className="text-faint">Perf / A11y — not measured yet</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Severity filter */}
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={severity === 'all'}
                onClick={() => setSeverity('all')}
                label={`All (${issues.length})`}
              />
              {counts
                .filter((c) => c.count > 0)
                .map((c) => (
                  <FilterChip
                    key={c.severity}
                    active={severity === c.severity}
                    onClick={() => setSeverity(c.severity)}
                    label={`${c.severity} (${c.count})`}
                  />
                ))}
            </div>

            {/* Issues — each expands to show where it lives */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-text">Issues</h2>
              {shown.length === 0 ? (
                <EmptyState
                  title="No issues"
                  description="This page passed every check at this severity."
                />
              ) : (
                <div className="space-y-2">
                  {shown.map((issue: IssueDetail) => (
                    <IssueCard key={issue.id} issue={issue} />
                  ))}
                </div>
              )}
            </section>

            {/* Structured data */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-text">
                Structured data{' '}
                <span className="font-normal text-muted">
                  ({entities.length} {entities.length === 1 ? 'entity' : 'entities'})
                </span>
              </h2>
              {entities.length === 0 ? (
                <EmptyState
                  title="No structured data"
                  description="This page has no JSON-LD, Microdata or RDFa markup."
                />
              ) : (
                <div className="space-y-2">
                  {entities.map((entity) => (
                    <SchemaCard key={entity.id} entity={entity} />
                  ))}
                </div>
              )}
            </section>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
        active
          ? 'border-primary/30 bg-primary-soft text-primary'
          : 'border-border bg-surface text-muted hover:bg-surface-hover hover:text-text',
      )}
    >
      {label}
    </button>
  );
}
