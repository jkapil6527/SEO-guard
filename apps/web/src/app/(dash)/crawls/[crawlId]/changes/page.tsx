'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { CrawlChange } from '@/lib/types';
import { useCrawlChanges, useChangesSummary } from '@/features/schema/api';
import { Section, Card, EmptyState, QueryBoundary } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { SeverityBadge, Pill } from '@/components/badges';
import { BarList } from '@/components/charts';

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function compact(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function ChangeDetail({ change }: { change: CrawlChange }) {
  const before = compact(change.before);
  const after = compact(change.after);
  const hasBefore = before.length > 0;
  const hasAfter = after.length > 0;

  if (hasBefore && !hasAfter) {
    return (
      <span className="text-xs text-red-600 dark:text-red-400">removed: {truncate(before)}</span>
    );
  }
  if (!hasBefore && hasAfter) {
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400">
        added: {truncate(after)}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
      {truncate(before, 40)} <span className="text-slate-400">→</span> {truncate(after, 40)}
    </span>
  );
}

function SummarySection({ crawlId }: { crawlId: string }) {
  const query = useChangesSummary(crawlId);
  return (
    <QueryBoundary query={query} isEmpty={(d) => d.length === 0} empty={null}>
      {(summary) => (
        <Card className="mb-8">
          <h3 className="mb-4 text-sm font-semibold">Changes by type</h3>
          <BarList
            items={summary.map((s) => ({ label: humanize(s.changeType), value: s.count }))}
          />
        </Card>
      )}
    </QueryBoundary>
  );
}

export default function CrawlChangesPage() {
  const { crawlId } = useParams<{ crawlId: string }>();
  const [changeType, setChangeType] = useState<string>('');
  const summaryQuery = useChangesSummary(crawlId);
  const query = useCrawlChanges(crawlId, changeType || undefined);

  const changeTypes = summaryQuery.data?.map((s) => s.changeType) ?? [];

  const columns: Column<CrawlChange>[] = [
    {
      key: 'changeType',
      header: 'Change',
      render: (row) => <Pill>{humanize(row.changeType)}</Pill>,
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      key: 'url',
      header: 'Page',
      render: (row) => (
        <span
          className="block max-w-md truncate font-mono text-xs text-slate-600 dark:text-slate-300"
          title={row.url ?? ''}
        >
          {row.url ?? '—'}
        </span>
      ),
    },
    {
      key: 'detail',
      header: 'Detail',
      render: (row) => <ChangeDetail change={row} />,
    },
  ];

  return (
    <div>
      <SummarySection crawlId={crawlId} />

      <Section title="Changes" description="What changed versus the previous crawl.">
        <div className="mb-4 flex flex-wrap gap-2">
          {(['', ...changeTypes] as string[]).map((type) => {
            const active = changeType === type;
            return (
              <button
                key={type || 'all'}
                type="button"
                onClick={() => setChangeType(type)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {type ? humanize(type) : 'all'}
              </button>
            );
          })}
        </div>

        <QueryBoundary
          query={query}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <EmptyState
              title="No changes vs the previous crawl"
              description="This is normal for a first crawl, or when nothing changed."
            />
          }
        >
          {(data) => <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />}
        </QueryBoundary>
      </Section>
    </div>
  );
}
