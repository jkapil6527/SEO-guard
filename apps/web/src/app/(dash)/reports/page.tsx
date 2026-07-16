'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCrawlReports } from '@/features/crawls/api';
import { useProjects } from '@/features/projects/api';
import { Section, QueryBoundary, EmptyState } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { StatusBadge, Pill } from '@/components/badges';
import { selectClasses } from '@/components/form';
import type { CrawlReport } from '@/lib/types';

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function scoreClass(score: number): string {
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/** What the crawl covered: the whole site, or one page (with the URL's path). */
function Target({ crawl }: { crawl: CrawlReport }) {
  if (crawl.scope !== 'page') {
    return <Pill>Site · {crawl.mode}</Pill>;
  }
  let path = crawl.targetUrl ?? '';
  try {
    if (crawl.targetUrl) path = new URL(crawl.targetUrl).pathname;
  } catch {
    // fall back to the raw value
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Pill>Page</Pill>
      <span
        title={crawl.targetUrl ?? undefined}
        className="truncate font-mono text-xs text-slate-500 dark:text-slate-400"
      >
        {path}
      </span>
    </span>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const projects = useProjects();
  const reports = useCrawlReports(projectId || undefined);

  const columns: Column<CrawlReport>[] = [
    { key: 'started', header: 'Started', render: (c) => fmt(c.startedAt ?? c.createdAt) },
    {
      key: 'website',
      header: 'Website',
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{c.websiteName}</span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {c.projectName}
          </span>
        </span>
      ),
    },
    { key: 'scope', header: 'Scope', render: (c) => <Target crawl={c} /> },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'pages',
      header: 'Pages',
      align: 'right',
      render: (c) => `${c.stats.crawled ?? 0}/${c.stats.total ?? 0}`,
    },
    {
      key: 'score',
      header: 'Score',
      align: 'right',
      render: (c) => {
        if (c.seoScore === null) return <span className="text-slate-400">—</span>;
        const score = Number(c.seoScore);
        return <span className={`font-semibold ${scoreClass(score)}`}>{score.toFixed(0)}</span>;
      },
    },
    { key: 'finished', header: 'Finished', render: (c) => fmt(c.finishedAt) },
  ];

  return (
    <Section
      title="Reports"
      description="Every crawl across the workspace. Open one to see its pages, issues and schema."
      actions={
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Filter by project"
          className={selectClasses}
        >
          <option value="">All projects</option>
          {(projects.data?.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      }
    >
      <QueryBoundary
        query={reports}
        isEmpty={(d) => d.data.length === 0}
        empty={
          <EmptyState
            title="No crawls yet"
            description="Reports appear here once you crawl a website. Open a website and start a crawl — full site or a single page."
          />
        }
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data.data}
            rowKey={(c) => c.id}
            onRowClick={(c) => router.push(`/crawls/${c.id}`)}
          />
        )}
      </QueryBoundary>
    </Section>
  );
}
