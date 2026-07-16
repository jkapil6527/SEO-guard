'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCrawlHistory, useIssueSummary } from '@/features/crawls/api';
import { useSchemaCoverage } from '@/features/schema/api';
import { StartCrawlButton } from '@/features/crawls/start-crawl-button';
import { Section, Card, Metric, QueryBoundary, EmptyState, ProgressBar } from '@/components/ui';
import { Donut, LineChart, ScoreGauge, SEVERITY_COLORS } from '@/components/charts';
import { StatusBadge } from '@/components/badges';
import type { Crawl } from '@/lib/types';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;
const ACTIVE = ['queued', 'resolving', 'running', 'paused', 'finalizing'];

export default function WebsiteOverviewPage() {
  const params = useParams<{ websiteId: string }>();
  const history = useCrawlHistory(params.websiteId);

  const crawls = history.data?.data ?? [];
  const latest = crawls.find((c) => c.status === 'completed') ?? crawls[0];
  const active = crawls.find((c) => ACTIVE.includes(c.status));

  return (
    <div>
      <Section
        title="Overview"
        description="The latest completed crawl for this website."
        actions={<StartCrawlButton websiteId={params.websiteId} />}
      >
        <QueryBoundary
          query={history}
          isEmpty={() => crawls.length === 0}
          empty={
            <EmptyState
              title="No crawls yet"
              description="Hit “Start crawl” to analyze this website. It will crawl the homepage and discover internal links; add a sitemap or URL list under Sources for complete coverage."
            />
          }
        >
          {() => (
            <div className="space-y-6">
              {active && (
                <Link href={`/crawls/${active.id}`} className="block">
                  <Card className="border-blue-200 bg-blue-50/50 transition-colors hover:border-blue-400 dark:border-blue-900 dark:bg-blue-950/30">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300">
                        <StatusBadge status={active.status} /> Crawl in progress
                      </span>
                      <span className="text-sm tabular-nums text-blue-700 dark:text-blue-300">
                        {active.stats.crawled ?? 0}/{active.stats.total ?? 0}
                      </span>
                    </div>
                    <ProgressBar
                      percent={
                        active.stats.total
                          ? ((active.stats.crawled ?? 0) / active.stats.total) * 100
                          : 0
                      }
                    />
                  </Card>
                </Link>
              )}
              {latest ? <LatestCrawlSummary crawl={latest} /> : null}
              <ScoreTrend crawls={crawls} />
            </div>
          )}
        </QueryBoundary>
      </Section>
    </div>
  );
}

function LatestCrawlSummary({ crawl }: { crawl: Crawl }) {
  const summary = useIssueSummary(crawl.id);
  const coverage = useSchemaCoverage(crawl.id);
  const score = summary.data?.aggregate ? Number(summary.data.aggregate.seoScore) : null;
  const bySeverity = summary.data?.bySeverity ?? [];
  const donut = SEVERITY_ORDER.map((sev) => ({
    label: sev,
    value: bySeverity.find((s) => s.severity === sev)?.count ?? 0,
    color: SEVERITY_COLORS[sev]!,
  })).filter((s) => s.value > 0);
  const metrics = summary.data?.aggregate?.metrics;
  const schema = coverage.data?.coverage;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="flex flex-col items-center justify-center gap-2 text-center">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
          SEO score
        </p>
        {score !== null ? <ScoreGauge score={score} /> : <p className="py-8 text-slate-400">—</p>}
        <Link
          href={`/crawls/${crawl.id}`}
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View crawl →
        </Link>
      </Card>

      <Card>
        <p className="mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Issues by severity
        </p>
        {donut.length > 0 ? (
          <Donut segments={donut} size={130} />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">No issues found</p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          label="Pages"
          value={crawl.stats.crawled ?? 0}
          hint={`${crawl.stats.failed ?? 0} failed`}
        />
        <Metric label="Broken links" value={metrics?.brokenLinks ?? 0} />
        <Metric label="Schema entities" value={schema?.totalEntities ?? 0} />
        <Metric
          label="Rich-eligible"
          value={schema?.richEligible ?? 0}
          hint={`${schema?.pagesWithSchema ?? 0} pages w/ schema`}
        />
      </div>
    </div>
  );
}

function ScoreTrend({ crawls }: { crawls: Crawl[] }) {
  // Not every crawl row carries a score; use the summary-less proxy of failed-rate is noisy,
  // so we plot the recorded scores we can read from completed crawls in chronological order.
  const completed = crawls
    .filter((c) => c.status === 'completed')
    .slice(0, 20)
    .reverse();
  if (completed.length < 2) return null;
  // The crawl list endpoint does not include the score; link out instead of a misleading line.
  return (
    <Card>
      <p className="mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Recent crawls
      </p>
      <LineChart
        points={completed.map((c, i) => ({
          x: String(i),
          y: c.stats.crawled ?? 0,
        }))}
        yMin={0}
      />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Pages crawled across the last {completed.length} completed crawls.
      </p>
    </Card>
  );
}
