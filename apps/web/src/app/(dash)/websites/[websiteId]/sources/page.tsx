'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  useSources,
  useCreateSource,
  useUploadCsvSource,
  useDeleteSource,
} from '@/features/sources/api';
import { Section, Card, QueryBoundary, EmptyState } from '@/components/ui';
import { Pill } from '@/components/badges';
import {
  inputClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '@/components/form';
import type { UrlSource } from '@/lib/types';

function describe(source: UrlSource): string {
  const c = source.config;
  if (c.kind === 'manual') return `${c.urls.length} URL${c.urls.length === 1 ? '' : 's'}`;
  if (c.kind === 'sitemap') return c.sitemapUrl;
  if (c.kind === 'csv') return `${c.originalFilename} (${c.rowCount} rows)`;
  if (c.kind === 'discovery') return `seeds: ${c.seeds.join(', ')} · depth ${c.maxDepth}`;
  return '';
}

export default function SourcesPage() {
  const params = useParams<{ websiteId: string }>();
  const websiteId = params.websiteId;
  const sources = useSources(websiteId);
  const del = useDeleteSource(websiteId);

  return (
    <div className="space-y-8">
      <Section title="URL sources" description="Where this website's crawl gets its URLs from.">
        <QueryBoundary
          query={sources}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <EmptyState
              title="No sources yet"
              description="Add a sitemap, URL list or CSV below."
            />
          }
        >
          {(data) => (
            <div className="space-y-2">
              {data.data.map((s) => (
                <Card key={s.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Pill>{s.type}</Pill>
                    <span className="truncate text-sm text-slate-600 dark:text-slate-300">
                      {describe(s)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => del.mutate(s.id)}
                    className="shrink-0 text-sm text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </Card>
              ))}
            </div>
          )}
        </QueryBoundary>
      </Section>

      <AddSourceForms websiteId={websiteId} />
    </div>
  );
}

function AddSourceForms({ websiteId }: { websiteId: string }) {
  const create = useCreateSource(websiteId);
  const uploadCsv = useUploadCsvSource(websiteId);
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [urls, setUrls] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);

  return (
    <Section title="Add a source">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Sitemap</h3>
          <label htmlFor="sitemap" className={labelClasses}>
            Sitemap URL
          </label>
          <input
            id="sitemap"
            className={inputClasses}
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            placeholder="https://example.com/sitemap.xml"
          />
          <button
            type="button"
            disabled={!sitemapUrl.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                { type: 'sitemap', sitemapUrl: sitemapUrl.trim() },
                { onSuccess: () => setSitemapUrl('') },
              )
            }
            className={`${primaryButtonClasses} mt-3 w-full justify-center`}
          >
            Add sitemap
          </button>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold">URL list</h3>
          <label htmlFor="urls" className={labelClasses}>
            One URL per line
          </label>
          <textarea
            id="urls"
            className={`${inputClasses} h-24 resize-none`}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={'https://example.com/\nhttps://example.com/about'}
          />
          <button
            type="button"
            disabled={!urls.trim() || create.isPending}
            onClick={() => {
              const list = urls
                .split('\n')
                .map((u) => u.trim())
                .filter(Boolean);
              create.mutate({ type: 'manual', urls: list }, { onSuccess: () => setUrls('') });
            }}
            className={`${primaryButtonClasses} mt-3 w-full justify-center`}
          >
            Add URLs
          </button>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold">CSV upload</h3>
          <label htmlFor="csv" className={labelClasses}>
            CSV file with a <span className="font-mono">url</span> column
          </label>
          <input
            id="csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm dark:text-slate-300 dark:file:bg-slate-800"
          />
          <button
            type="button"
            disabled={!csvFile || uploadCsv.isPending}
            onClick={() => {
              if (csvFile)
                uploadCsv.mutate({ file: csvFile }, { onSuccess: () => setCsvFile(null) });
            }}
            className={`${secondaryButtonClasses} mt-3 w-full justify-center`}
          >
            {uploadCsv.isPending ? 'Uploading…' : 'Upload CSV'}
          </button>
        </Card>
      </div>
      {(create.error || uploadCsv.error) && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {((create.error ?? uploadCsv.error) as Error).message}
        </p>
      )}
    </Section>
  );
}
