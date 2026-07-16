'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProjectBySlug } from '@/features/projects/api';
import { useCategories, useCategoryTrend } from '@/features/categories/api';
import { CrawlSitemapDialog } from '@/features/categories/crawl-sitemap-dialog';
import { QueryBoundary, EmptyState } from '@/components/feedback/query-boundary';
import { TableSkeleton } from '@/components/primitives/skeleton';
import { Button } from '@/components/primitives/button';
import { StatusBadge, ScoreBadge } from '@/components/primitives/badge';
import { HealthGauge, Sparkline } from '@/components/charts/charts';
import { DataTable } from '@/components/data/data-table';
import type { Column } from '@/components/data/data-table';
import { useCrawlReports } from '@/features/crawls/api';
import type { CrawlReport } from '@/lib/types';
import { formatDateTime } from '@/utils/format';

/** A single category: health, trend, and its own crawl history. */
export default function CategoryPage() {
  const params = useParams<{ slug: string; groupId: string }>();
  const { project } = useProjectBySlug(params.slug);
  const categories = useCategories(project?.id);
  const trend = useCategoryTrend(params.groupId);
  const reports = useCrawlReports(project?.id);
  const [crawlOpen, setCrawlOpen] = useState(false);

  const group = categories.data?.data.find((g) => g.id === params.groupId);
  const crawls = (reports.data?.data ?? []).filter((c) => c.sitemapGroupId === params.groupId);

  const columns: Column<CrawlReport>[] = [
    {
      key: 'started',
      header: 'Started',
      sortKey: 'started',
      render: (c) => formatDateTime(c.startedAt ?? c.createdAt),
    },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    { key: 'mode', header: 'Mode', render: (c) => <span className="capitalize">{c.mode}</span> },
    {
      key: 'pages',
      header: 'Pages',
      align: 'right',
      render: (c) => `${(c.stats.crawled ?? 0).toLocaleString()}/${(c.stats.total ?? 0).toLocaleString()}`,
    },
    {
      key: 'score',
      header: 'Score',
      align: 'right',
      render: (c) => <ScoreBadge score={c.seoScore === null ? null : Number(c.seoScore)} />,
    },
    { key: 'finished', header: 'Finished', render: (c) => formatDateTime(c.finishedAt) },
  ];

  if (!group) {
    return (
      <QueryBoundary query={categories} skeleton={<TableSkeleton rows={3} />}>
        {() => (
          <EmptyState
            title="Category not found"
            description="It may have been deleted."
            action={
              <Link href={`/projects/${params.slug}`} className="text-sm text-primary underline">
                Back to project
              </Link>
            }
          />
        )}
      </QueryBoundary>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <HealthGauge score={group.healthScore === null ? null : Number(group.healthScore)} size={64} />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-text">{group.name}</h1>
            <p className="mt-0.5 truncate font-mono text-xs text-muted">
              {group.sitemapUrl ?? 'No sitemap configured'}
            </p>
            <p className="mt-1 text-sm text-muted">
              {group.totalUrls.toLocaleString()} URLs ·{' '}
              <span className="text-danger">{group.errors.toLocaleString()} errors</span> ·{' '}
              <span className="text-warning">{group.warnings.toLocaleString()} warnings</span> ·{' '}
              <span className="text-danger">{group.brokenUrls.toLocaleString()} broken</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/projects/${params.slug}/categories/${group.id}/urls`}
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3.5 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
          >
            View URLs
          </Link>
          <Button onClick={() => setCrawlOpen(true)}>
            {group.sitemapUrl ? 'Crawl sitemap' : 'Add sitemap'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">Score trend (30 days)</h2>
        <div className="mt-3 h-16">
          <Sparkline values={(trend.data?.data ?? []).map((d) => Number(d.seoScore))} height={60} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text">Crawl history</h2>
        <QueryBoundary query={reports} skeleton={<TableSkeleton rows={4} cols={6} />}>
          {() => (
            <DataTable
              columns={columns}
              rows={crawls}
              rowKey={(c) => c.id}
              rowHref={(c) => `/crawls/${c.id}`}
              empty={
                <EmptyState
                  title="Not crawled yet"
                  description="Crawl this category's sitemap to see its URLs, issues and score."
                  action={<Button onClick={() => setCrawlOpen(true)}>Crawl sitemap</Button>}
                />
              }
            />
          )}
        </QueryBoundary>
      </div>

      <CrawlSitemapDialog
        group={group}
        open={crawlOpen}
        onOpenChange={setCrawlOpen}
        projectId={group.projectId}
      />
    </div>
  );
}
