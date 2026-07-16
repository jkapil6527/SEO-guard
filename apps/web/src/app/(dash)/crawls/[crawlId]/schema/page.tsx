'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { SchemaEntity } from '@/lib/types';
import { useSchemaCoverage, useSchemaEntities, useRichResults } from '@/features/schema/api';
import { Section, Card, Metric, EmptyState, QueryBoundary } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { StatusBadge, Pill } from '@/components/badges';
import { Donut, BarList } from '@/components/charts';
import { inputClasses, secondaryButtonClasses } from '@/components/form';
import { exportCsv, exportJson } from '@/lib/export';

const STATUS_COLORS: Record<string, string> = {
  valid: '#10b981',
  warnings: '#f59e0b',
  errors: '#ef4444',
  invalid_json: '#ef4444',
};

const ENTITY_STATUSES = ['valid', 'warnings', 'errors', 'invalid_json'] as const;

function CoverageSection({ crawlId }: { crawlId: string }) {
  const query = useSchemaCoverage(crawlId);
  return (
    <QueryBoundary query={query}>
      {(coverage) => {
        const donut = coverage.statusCounts
          .map((s) => ({
            label: s.status,
            value: s.count,
            color: STATUS_COLORS[s.status] ?? '#64748b',
          }))
          .filter((s) => s.value > 0);
        const bars = coverage.typeFrequency.map((t) => ({ label: t.schemaType, value: t.count }));
        return (
          <div className="mb-8">
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <Metric
                label="Total entities"
                value={coverage.coverage.totalEntities.toLocaleString()}
              />
              <Metric
                label="Pages with schema"
                value={coverage.coverage.pagesWithSchema.toLocaleString()}
              />
              <Metric
                label="Rich-eligible"
                value={coverage.coverage.richEligible.toLocaleString()}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="mb-4 text-sm font-semibold">Validation status</h3>
                {donut.length > 0 ? (
                  <Donut segments={donut} />
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No entities.</p>
                )}
              </Card>
              <Card>
                <h3 className="mb-4 text-sm font-semibold">Schema types</h3>
                <BarList items={bars} />
              </Card>
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

function RichResultsSection({ crawlId }: { crawlId: string }) {
  const query = useRichResults(crawlId);
  return (
    <Section title="Rich results" description="Eligibility grouped by rich-result profile.">
      <QueryBoundary
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="No rich results"
            description="No rich-result profiles detected in this crawl."
          />
        }
      >
        {(data) => (
          <Card>
            <BarList
              items={data.map((r) => ({ label: `${r.profile} · ${r.status}`, value: r.count }))}
            />
          </Card>
        )}
      </QueryBoundary>
    </Section>
  );
}

export default function CrawlSchemaPage() {
  const { crawlId } = useParams<{ crawlId: string }>();
  const [schemaType, setSchemaType] = useState('');
  const [status, setStatus] = useState('');
  const query = useSchemaEntities(crawlId, {
    schemaType: schemaType.trim() || undefined,
    status: status || undefined,
  });

  const rows = query.data?.data ?? [];

  const columns: Column<SchemaEntity>[] = [
    {
      key: 'schemaType',
      header: 'Type',
      render: (row) => <Pill>{row.schemaType}</Pill>,
    },
    {
      key: 'format',
      header: 'Format',
      render: (row) => <Pill>{row.format}</Pill>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'url',
      header: 'Page',
      render: (row) => (
        <Link
          href={`/crawls/${crawlId}/pages/${row.pageId}`}
          className="block max-w-xs truncate font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
          title={row.url}
        >
          {row.url}
        </Link>
      ),
    },
    {
      key: 'rich',
      header: 'Rich profiles',
      render: (row) =>
        row.richResults && row.richResults.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.richResults.map((r) => (
              <StatusBadge key={r.profile} status={r.eligible ? 'eligible' : 'ineligible'}>
                {r.profile}
              </StatusBadge>
            ))}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  function handleExportCsv() {
    exportCsv(
      rows.map((row) => ({
        schemaType: row.schemaType,
        format: row.format,
        status: row.status,
        url: row.url,
      })),
      ['schemaType', 'format', 'status', 'url'],
      `crawl-${crawlId}-schema`,
    );
  }

  return (
    <div>
      <CoverageSection crawlId={crawlId} />
      <RichResultsSection crawlId={crawlId} />

      <Section
        title="Entities"
        description="Every structured-data entity extracted from the crawl."
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
              onClick={() => exportJson(rows, `crawl-${crawlId}-schema`)}
              className={secondaryButtonClasses}
              disabled={rows.length === 0}
            >
              Export JSON
            </button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={schemaType}
            onChange={(e) => setSchemaType(e.target.value)}
            placeholder="Filter by schema type…"
            className={`${inputClasses} sm:max-w-xs`}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${inputClasses} sm:max-w-xs`}
          >
            <option value="">All statuses</option>
            {ENTITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <QueryBoundary
          query={query}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <EmptyState title="No entities" description="No schema entities match these filters." />
          }
        >
          {(data) => <DataTable columns={columns} rows={data.data} rowKey={(row) => row.id} />}
        </QueryBoundary>
      </Section>
    </div>
  );
}
