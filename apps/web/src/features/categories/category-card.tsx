'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/primitives/button';
import { Dialog } from '@/components/primitives/dialog';
import { StatusBadge } from '@/components/primitives/badge';
import { HealthGauge, Sparkline } from '@/components/charts/charts';
import { IconTrash } from '@/components/icons';
import { useCategoryTrend, useDeleteCategory } from '@/features/categories/api';
import { CrawlSitemapDialog } from '@/features/categories/crawl-sitemap-dialog';
import { cn } from '@/utils/cn';
import type { SitemapGroupSummary } from '@/lib/types';

const ACTIVE = ['queued', 'resolving', 'running', 'paused', 'finalizing'];

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * One sitemap category. Every number is a link into a pre-filtered URL list —
 * a statistic you cannot act on is decoration.
 */
export function CategoryCard({
  group,
  projectSlug,
}: {
  group: SitemapGroupSummary;
  projectSlug: string;
}) {
  const [crawlOpen, setCrawlOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const trend = useCategoryTrend(group.id);
  const remove = useDeleteCategory(group.projectId);
  const crawling = !!group.lastCrawlStatus && ACTIVE.includes(group.lastCrawlStatus);
  const score = group.healthScore === null ? null : Number(group.healthScore);
  const base = `/projects/${projectSlug}/categories/${group.id}`;

  const progress =
    crawling && group.stats?.total
      ? Math.round(((group.stats.crawled ?? 0) / group.stats.total) * 100)
      : null;

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={base}
            className="block truncate text-sm font-semibold text-text hover:text-primary"
          >
            {group.name}
          </Link>
          {/* <p className="mt-0.5 truncate text-xs text-muted">{group.websiteName}</p> */}
        </div>
        {group.lastCrawlStatus ? (
          <StatusBadge status={group.lastCrawlStatus} />
        ) : (
          <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs font-semibold text-faint">
            Never crawled
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <HealthGauge score={score} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text tabular-nums">
            {group.totalUrls.toLocaleString()}{' '}
            <span className="font-normal text-muted">
              {group.totalUrls === 1 ? 'URL' : 'URLs'}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">Last crawl {relativeTime(group.lastCrawlAt)}</p>
          {progress !== null ? (
            <div className="mt-2">
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Crawl progress for ${group.name}`}
                className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted tabular-nums">
                {(group.stats?.crawled ?? 0).toLocaleString()} /{' '}
                {(group.stats?.total ?? 0).toLocaleString()} · {progress}%
              </p>
            </div>
          ) : (
            <div className="mt-2">
              <Sparkline values={(trend.data?.data ?? []).map((d) => Number(d.seoScore))} />
            </div>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
        <Stat label="Errors" value={group.errors} href={`${base}/urls?hasErrors=1`} tone="danger" />
        <Stat
          label="Warnings"
          value={group.warnings}
          href={`${base}/urls?hasWarnings=1`}
          tone="warning"
        />
        <Stat
          label="Broken"
          value={group.brokenUrls}
          href={`${base}/urls?brokenLinks=1`}
          tone="danger"
        />
      </dl>

      <div className="mt-4 flex gap-2">
        {group.sitemapUrl ? (
          <Button size="sm" onClick={() => setCrawlOpen(true)} disabled={crawling}>
            {crawling ? 'Crawling…' : 'Crawl sitemap'}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setCrawlOpen(true)}>
            Add sitemap
          </Button>
        )}
        <Link
          href={base}
          className="inline-flex h-8 items-center justify-center rounded-md px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          View
        </Link>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          disabled={crawling}
          aria-label={`Delete category ${group.name}`}
          title={crawling ? 'Cancel the running crawl before deleting' : 'Delete category'}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          <IconTrash className="h-4 w-4" />
        </button>
      </div>

      <CrawlSitemapDialog
        group={group}
        open={crawlOpen}
        onOpenChange={setCrawlOpen}
        projectId={group.projectId}
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        size="sm"
        title={`Delete “${group.name}”?`}
        description="This cannot be undone."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(group.id, { onSuccess: () => setDeleteOpen(false) })
              }
            >
              Delete category
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          The category and every crawl run under it — including their pages, issues and score
          history — will be permanently deleted.
        </p>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: 'danger' | 'warning';
}) {
  const colour =
    value === 0 ? 'text-faint' : tone === 'danger' ? 'text-danger' : 'text-warning';
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd>
        <Link
          href={href}
          className={cn('text-sm font-semibold tabular-nums hover:underline', colour)}
        >
          {value.toLocaleString()}
        </Link>
      </dd>
    </div>
  );
}
