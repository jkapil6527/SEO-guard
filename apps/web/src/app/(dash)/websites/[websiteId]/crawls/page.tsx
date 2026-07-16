'use client';

import { useRouter, useParams } from 'next/navigation';
import { useCrawlHistory } from '@/features/crawls/api';
import { StartCrawlButton } from '@/features/crawls/start-crawl-button';
import { Section, QueryBoundary, EmptyState } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { StatusBadge } from '@/components/badges';
import type { Crawl } from '@/lib/types';

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function WebsiteCrawlsPage() {
  const params = useParams<{ websiteId: string }>();
  const router = useRouter();
  const history = useCrawlHistory(params.websiteId);

  const columns: Column<Crawl>[] = [
    { key: 'started', header: 'Started', render: (c) => fmt(c.startedAt ?? c.createdAt) },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'trigger',
      header: 'Trigger',
      render: (c) => <span className="capitalize">{c.trigger}</span>,
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (c) =>
        c.scope === 'page' ? (
          <span
            title={c.targetUrl ?? undefined}
            className="block max-w-[16rem] truncate font-mono text-xs"
          >
            {c.targetUrl ?? 'Single page'}
          </span>
        ) : (
          <span className="capitalize">Site · {c.mode}</span>
        ),
    },
    {
      key: 'pages',
      header: 'Pages',
      align: 'right',
      render: (c) => `${c.stats.crawled ?? 0}/${c.stats.total ?? 0}`,
    },
    { key: 'failed', header: 'Failed', align: 'right', render: (c) => c.stats.failed ?? 0 },
    { key: 'finished', header: 'Finished', render: (c) => fmt(c.finishedAt) },
  ];

  return (
    <Section
      title="Crawl history"
      description="Every crawl is a permanent snapshot. Open one to see its results."
      actions={<StartCrawlButton websiteId={params.websiteId} />}
    >
      <QueryBoundary
        query={history}
        isEmpty={(d) => d.data.length === 0}
        empty={
          <EmptyState
            title="No crawls yet"
            description="Start a crawl to analyze this website. With no sources configured it crawls the homepage and discovers internal links; add a sitemap or URL list under Sources for full coverage."
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
