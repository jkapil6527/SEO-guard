'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Issue, Severity } from '@/lib/types';
import { useCrawlIssues, useIssueSummary } from '@/features/crawls/api';
import { Section, Card, EmptyState, QueryBoundary } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { SeverityBadge } from '@/components/badges';
import { Donut, BarList, SEVERITY_COLORS } from '@/components/charts';
import { secondaryButtonClasses } from '@/components/form';
import { exportCsv, exportJson } from '@/lib/export';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function messageOf(evidence: Record<string, unknown>): string {
  const message = evidence.message;
  return typeof message === 'string' ? message : '—';
}

function SummaryCards({ crawlId }: { crawlId: string }) {
  const query = useIssueSummary(crawlId);
  return (
    <QueryBoundary query={query}>
      {(summary) => {
        const donut = summary.bySeverity
          .map((s) => ({
            label: s.severity,
            value: s.count,
            color: SEVERITY_COLORS[s.severity] ?? SEVERITY_COLORS.low,
          }))
          .filter((s) => s.value > 0);
        const bars = [...summary.byCheck]
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map((c) => ({ label: c.checkId, value: c.count }));
        return (
          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-sm font-semibold">By severity</h3>
              {donut.length > 0 ? (
                <Donut segments={donut} />
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No issues.</p>
              )}
            </Card>
            <Card>
              <h3 className="mb-4 text-sm font-semibold">Top checks</h3>
              <BarList items={bars} />
            </Card>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

export default function CrawlIssuesPage() {
  const { crawlId } = useParams<{ crawlId: string }>();
  const [severities, setSeverities] = useState<string[]>([]);
  const query = useCrawlIssues(crawlId, {
    severity: severities.length > 0 ? severities : undefined,
  });

  const rows = query.data?.data ?? [];

  function toggleSeverity(severity: string) {
    setSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity],
    );
  }

  const columns: Column<Issue>[] = [
    {
      key: 'checkId',
      header: 'Check',
      render: (row) => <span className="font-mono text-xs">{row.checkId}</span>,
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
      key: 'message',
      header: 'Message',
      render: (row) => (
        <span className="text-slate-700 dark:text-slate-300">{messageOf(row.evidence)}</span>
      ),
    },
  ];

  function handleExportCsv() {
    exportCsv(
      rows.map((row) => ({
        checkId: row.checkId,
        severity: row.severity,
        url: row.url,
        message: messageOf(row.evidence),
      })),
      ['checkId', 'severity', 'url', 'message'],
      `crawl-${crawlId}-issues`,
    );
  }

  return (
    <div>
      <SummaryCards crawlId={crawlId} />

      <Section
        title="Issues"
        description="Filter by severity to focus your review."
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
              onClick={() => exportJson(rows, `crawl-${crawlId}-issues`)}
              className={secondaryButtonClasses}
              disabled={rows.length === 0}
            >
              Export JSON
            </button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {SEVERITIES.map((severity) => {
            const active = severities.includes(severity);
            return (
              <button
                key={severity}
                type="button"
                onClick={() => toggleSeverity(severity)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {severity}
              </button>
            );
          })}
        </div>

        <QueryBoundary
          query={query}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <EmptyState title="No issues" description="No issues match the selected severities." />
          }
        >
          {(data) => <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />}
        </QueryBoundary>
      </Section>
    </div>
  );
}
