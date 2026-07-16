'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCrawl, useCrawlControl } from '@/features/crawls/api';
import { useCrawlProgress } from '@/lib/use-crawl-progress';
import { TabNav } from '@/components/tab-nav';
import { Card, ProgressBar } from '@/components/ui';
import { StatusBadge } from '@/components/badges';
import { secondaryButtonClasses } from '@/components/form';
import { IconGlobe } from '@/components/icons';

import type { CrawlReport } from '@/lib/types';

const ACTIVE = ['queued', 'resolving', 'running', 'paused', 'finalizing'];

/** Host without the leading www., e.g. `https://www.bikedekho.com` → `bikedekho.com`. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * A human name for the crawl header instead of the raw UUID. What identifies a
 * crawl depends on its scope: a single-page crawl is its target URL, a category
 * crawl is its group name, a full crawl is its website.
 */
function crawlHeading(
  crawl: CrawlReport | undefined,
  crawlId: string,
): { title: string; subtitle: string } {
  if (!crawl) return { title: 'Crawl', subtitle: crawlId };
  if (crawl.scope === 'page' && crawl.targetUrl) {
    return { title: hostOf(crawl.targetUrl), subtitle: crawl.targetUrl };
  }
  if (crawl.scope === 'group' && crawl.groupName) {
    return { title: crawl.groupName, subtitle: crawl.projectName ?? crawl.websiteName };
  }
  const site = crawl.websiteName || hostOf(crawl.websiteOrigin);
  return { title: site, subtitle: crawl.websiteOrigin };
}

function humanEta(ms?: number): string {
  if (!ms || ms <= 0) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `~${s}s left`;
  return `~${Math.round(s / 60)}m left`;
}

export default function CrawlLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ crawlId: string }>();
  const crawlId = params.crawlId;
  const crawl = useCrawl(crawlId, true);
  const isActive = crawl.data ? ACTIVE.includes(crawl.data.status) : false;
  const websiteId = crawl.data?.websiteId ?? '';
  const control = useCrawlControl(crawlId, websiteId);
  const live = useCrawlProgress(crawlId, isActive);

  const base = `/crawls/${crawlId}`;
  const tabs = [
    { label: 'Overview', href: base, exact: true },
    { label: 'Pages', href: `${base}/pages` },
    { label: 'Issues', href: `${base}/issues` },
    { label: 'Schema', href: `${base}/schema` },
    { label: 'Changes', href: `${base}/changes` },
  ];

  const status = crawl.data?.status ?? 'queued';
  const { title, subtitle } = crawlHeading(crawl.data, crawlId);
  const counters = live ?? {
    total: crawl.data?.stats.total ?? 0,
    crawled: crawl.data?.stats.crawled ?? 0,
    unchanged: crawl.data?.stats.unchanged ?? 0,
    failed: crawl.data?.stats.failed ?? 0,
    percent: crawl.data?.stats.total
      ? Math.round(((crawl.data.stats.crawled ?? 0) / crawl.data.stats.total) * 100)
      : 0,
    currentUrl: undefined as string | undefined,
    etaMs: undefined as number | undefined,
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {websiteId && (
            <Link
              href={`/websites/${websiteId}/crawls`}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              aria-label="Back to crawls"
            >
              <IconGlobe className="h-5 w-5" />
            </Link>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight" title={title}>
                {title}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={subtitle}>
              {subtitle}
            </p>
          </div>
        </div>
        {isActive && (
          <div className="flex gap-2">
            {status === 'paused' ? (
              <button
                type="button"
                onClick={() => control.mutate('resume')}
                className={secondaryButtonClasses}
              >
                Resume
              </button>
            ) : (
              <button
                type="button"
                onClick={() => control.mutate('pause')}
                className={secondaryButtonClasses}
              >
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={() => control.mutate('cancel')}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Cancel
            </button>
          </div>
        )}
        {status === 'completed' && (
          <button
            type="button"
            onClick={() => control.mutate('retry-failed')}
            className={secondaryButtonClasses}
          >
            Retry failed pages
          </button>
        )}
      </div>

      {isActive && (
        <Card className="mb-5 border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-blue-800 dark:text-blue-300">
              {counters.crawled + counters.unchanged + counters.failed} / {counters.total} pages
              {counters.failed > 0 ? ` · ${counters.failed} failed` : ''}
            </span>
            <span className="tabular-nums text-blue-700 dark:text-blue-300">
              {counters.percent}% {humanEta(counters.etaMs)}
            </span>
          </div>
          <ProgressBar percent={counters.percent} />
          {counters.currentUrl && (
            <p className="mt-2 truncate font-mono text-xs text-blue-700/70 dark:text-blue-300/70">
              {counters.currentUrl}
            </p>
          )}
        </Card>
      )}

      {crawl.data?.error && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {crawl.data.error}
        </p>
      )}

      <TabNav tabs={tabs} />
      {children}
    </div>
  );
}
