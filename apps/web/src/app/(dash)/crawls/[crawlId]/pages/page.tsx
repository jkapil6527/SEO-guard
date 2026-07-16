'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { PageSnapshot } from '@/lib/types';
import { useCrawlPages } from '@/features/crawls/api';
import { Section, EmptyState, QueryBoundary } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { StatusBadge } from '@/components/badges';
import { secondaryButtonClasses } from '@/components/form';
import { exportCsv, exportJson } from '@/lib/export';

const FETCH_STATUS_FILTERS = ['all', 'ok', 'error', 'redirected', 'unchanged'] as const;

function issueTotal(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

export default function CrawlPagesPage() {
  const { crawlId } = useParams<{ crawlId: string }>();
  const [fetchStatus, setFetchStatus] = useState<string>('all');
  const query = useCrawlPages(crawlId, fetchStatus === 'all' ? undefined : fetchStatus);

  const rows = query.data?.data ?? [];

  const columns: Column<PageSnapshot>[] = [
    {
      key: 'url',
      header: 'URL',
      render: (row) => (
        <Link
          href={`/crawls/${crawlId}/pages/${row.pageId}`}
          className="block max-w-md truncate font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
          title={row.url}
        >
          {row.url}
        </Link>
      ),
    },
    {
      key: 'httpStatus',
      header: 'HTTP',
      align: 'right',
      render: (row) => <span className="tabular-nums">{row.httpStatus ?? '—'}</span>,
    },
    {
      key: 'fetchStatus',
      header: 'Fetch',
      render: (row) => <StatusBadge status={row.fetchStatus} />,
    },
    {
      key: 'score',
      header: 'Score',
      align: 'right',
      render: (row) => <span className="tabular-nums">{row.score ?? '—'}</span>,
    },
    {
      key: 'issues',
      header: 'Issues',
      align: 'right',
      render: (row) => <span className="tabular-nums">{issueTotal(row.issueCounts)}</span>,
    },
  ];

  function handleExportCsv() {
    exportCsv(
      rows.map((row) => ({
        url: row.url,
        httpStatus: row.httpStatus ?? '',
        fetchStatus: row.fetchStatus,
        score: row.score ?? '',
      })),
      ['url', 'httpStatus', 'fetchStatus', 'score'],
      `crawl-${crawlId}-pages`,
    );
  }

  return (
    <Section
      title="Pages"
      description="Every page captured in this crawl."
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className={secondaryButtonClasses}
            disabled={rows.length === 0}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportJson(rows, `crawl-${crawlId}-pages`)}
            className={secondaryButtonClasses}
            disabled={rows.length === 0}
          >
            Export JSON
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FETCH_STATUS_FILTERS.map((status) => {
          const active = fetchStatus === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFetchStatus(status)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                active
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {status}
            </button>
          );
        })}
      </div>

      <QueryBoundary
        query={query}
        isEmpty={(d) => d.data.length === 0}
        empty={
          <EmptyState title="No pages" description="No pages match this filter for this crawl." />
        }
      >
        {(data) => <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />}
      </QueryBoundary>
    </Section>
  );
}
