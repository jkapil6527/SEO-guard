'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useIssueSummary } from '@/features/crawls/api';
import { useSchemaCoverage } from '@/features/schema/api';
import { Card, Metric, QueryBoundary } from '@/components/ui';
import { Donut, BarList, ScoreGauge, SEVERITY_COLORS } from '@/components/charts';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

/**
 * A 0–100 quality score for the crawl's structured data, from the mix of
 * validation statuses. Valid entities score full; warnings score most of the
 * way (they usually still yield rich results); errors and unparseable JSON
 * score little to nothing. Null when the crawl found no structured data.
 */
const SCHEMA_STATUS_WEIGHT: Record<string, number> = {
  valid: 1,
  warnings: 0.7,
  errors: 0.2,
  invalid_json: 0,
};

function schemaScoreOf(byStatus: Record<string, number> | undefined): number | null {
  if (!byStatus) return null;
  let total = 0;
  let weighted = 0;
  for (const [status, count] of Object.entries(byStatus)) {
    total += count;
    weighted += count * (SCHEMA_STATUS_WEIGHT[status] ?? 0);
  }
  if (total === 0) return null;
  return Math.round((weighted / total) * 100);
}

export default function CrawlOverviewPage() {
  const params = useParams<{ crawlId: string }>();
  const crawlId = params.crawlId;
  const summary = useIssueSummary(crawlId);
  const coverage = useSchemaCoverage(crawlId);

  return (
    <div className="space-y-6">
      <QueryBoundary query={summary}>
        {(data) => {
          const score = data.aggregate ? Number(data.aggregate.seoScore) : null;
          const donut = SEVERITY_ORDER.map((sev) => ({
            label: sev,
            value: data.bySeverity.find((s) => s.severity === sev)?.count ?? 0,
            color: SEVERITY_COLORS[sev]!,
          })).filter((s) => s.value > 0);
          const topChecks = data.byCheck
            .slice(0, 8)
            .map((c) => ({ label: c.checkId, value: c.count }));
          const metrics = data.aggregate?.metrics;
          const schemaScore = schemaScoreOf(metrics?.schema?.byStatus);

          return (
            <>
              <div className="grid gap-5 lg:grid-cols-3">
                <Card className="flex items-center justify-around gap-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                      SEO score
                    </p>
                    {score !== null ? (
                      <ScoreGauge score={score} size={96} />
                    ) : (
                      <p className="py-8 text-slate-400">—</p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                      Schema score
                    </p>
                    {schemaScore !== null ? (
                      <ScoreGauge score={schemaScore} size={96} />
                    ) : (
                      <p className="py-8 text-slate-400" title="No structured data found">
                        —
                      </p>
                    )}
                  </div>
                </Card>
                <Card>
                  <p className="mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    Issues by severity
                  </p>
                  {donut.length > 0 ? (
                    <Donut segments={donut} size={130} />
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-400">No issues 🎉</p>
                  )}
                </Card>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Pages crawled" value={metrics?.pagesScored ?? 0} />
                  <Metric label="Critical pages" value={metrics?.criticalPages ?? 0} />
                  <Metric label="Broken links" value={metrics?.brokenLinks ?? 0} />
                  <Metric label="Schema entities" value={metrics?.schema?.totalEntities ?? 0} />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                      Top issues
                    </p>
                    <Link
                      href={`/crawls/${crawlId}/issues`}
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View all →
                    </Link>
                  </div>
                  <BarList items={topChecks} />
                </Card>

                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                      Schema coverage
                    </p>
                    <Link
                      href={`/crawls/${crawlId}/schema`}
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Analyze →
                    </Link>
                  </div>
                  <QueryBoundary query={coverage}>
                    {(cov) => (
                      <BarList
                        items={cov.typeFrequency
                          .slice(0, 8)
                          .map((t) => ({ label: t.schemaType, value: t.count }))}
                      />
                    )}
                  </QueryBoundary>
                </Card>
              </div>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
