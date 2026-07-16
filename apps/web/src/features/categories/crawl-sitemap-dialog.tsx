'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/primitives/dialog';
import { Button } from '@/components/primitives/button';
import { Input, Label, FieldError } from '@/components/primitives/input';
import {
  usePreviewSitemap,
  useStartCategoryCrawl,
  useUpdateCategory,
} from '@/features/categories/api';
import { ApiError } from '@/lib/api';
import type { SitemapGroupSummary } from '@/lib/types';

/**
 * Paste a sitemap, see exactly what it contains, then commit. Previewing before
 * crawling is the difference between "start a crawl and hope" and knowing you
 * pointed at the right 1,240 URLs.
 */
export function CrawlSitemapDialog({
  group,
  open,
  onOpenChange,
  projectId,
}: {
  group: SitemapGroupSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(group.sitemapUrl ?? '');
  const [mode, setMode] = useState<'incremental' | 'full'>('incremental');
  const [error, setError] = useState<string | null>(null);

  const preview = usePreviewSitemap(group.id);
  const update = useUpdateCategory(projectId);
  const start = useStartCategoryCrawl(projectId);

  useEffect(() => {
    if (open) {
      setUrl(group.sitemapUrl ?? '');
      setError(null);
      preview.reset();
    }
    // preview is a stable mutation object; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group.sitemapUrl]);

  const runPreview = async () => {
    setError(null);
    try {
      await preview.mutateAsync(url.trim() || undefined);
    } catch (err) {
      setError(fieldMessage(err));
    }
  };

  const startCrawl = async () => {
    setError(null);
    try {
      // Persist a changed sitemap URL before crawling it, or the worker would
      // resolve the old one.
      if (url.trim() && url.trim() !== group.sitemapUrl) {
        await update.mutateAsync({ groupId: group.id, sitemapUrl: url.trim() });
      }
      const res = await start.mutateAsync({ groupId: group.id, mode });
      onOpenChange(false);
      router.push(`/crawls/${res.crawlId}`);
    } catch (err) {
      setError(fieldMessage(err));
    }
  };

  const result = preview.data;
  const busy = preview.isPending || start.isPending || update.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Crawl sitemap — ${group.name}`}
      description="Only the URLs in this sitemap are crawled. Links are checked, not followed."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={startCrawl} loading={start.isPending} disabled={!url.trim() || busy}>
            Start crawl
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="sitemap-url">Sitemap URL</Label>
          <div className="flex gap-2">
            <Input
              id="sitemap-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={`${group.websiteOrigin}/sitemap.xml`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'sitemap-url-error' : undefined}
            />
            <Button
              variant="secondary"
              onClick={runPreview}
              loading={preview.isPending}
              disabled={!url.trim()}
            >
              Preview
            </Button>
          </div>
          <FieldError id="sitemap-url-error" message={error ?? undefined} />
        </div>

        {result && (
          <div className="rounded-lg border border-success/30 bg-success-soft p-3">
            <p className="text-sm font-medium text-success">
              Found {result.total.toLocaleString()} {result.total === 1 ? 'URL' : 'URLs'} across{' '}
              {result.sitemapCount} {result.sitemapCount === 1 ? 'sitemap' : 'nested sitemaps'}
            </p>
            {result.truncated && (
              <p className="mt-1 text-xs text-warning">
                The sitemap is larger than the crawl limit — only the first{' '}
                {result.total.toLocaleString()} URLs will be crawled.
              </p>
            )}
            {result.errors > 0 && (
              <p className="mt-1 text-xs text-warning">
                {result.errors} nested {result.errors === 1 ? 'sitemap' : 'sitemaps'} could not be
                read and will be skipped.
              </p>
            )}
            <ul className="mt-2 space-y-0.5">
              {result.sample.map((u) => (
                <li key={u} className="truncate font-mono text-xs text-muted">
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">Mode</legend>
          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="crawl-mode"
                checked={mode === 'incremental'}
                onChange={() => setMode('incremental')}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span>
                <span className="font-medium text-text">Incremental</span>
                <span className="block text-xs text-muted">
                  Only re-fetch pages that changed since the last crawl of this category.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="crawl-mode"
                checked={mode === 'full'}
                onChange={() => setMode('full')}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span>
                <span className="font-medium text-text">Full</span>
                <span className="block text-xs text-muted">Re-fetch every page.</span>
              </span>
            </label>
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}

function fieldMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.fieldErrors.find((f) => f.field === 'sitemapUrl')?.message ?? err.message;
  }
  return 'Unable to reach the server. Please try again.';
}
