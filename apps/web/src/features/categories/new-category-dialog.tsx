'use client';

import { useState } from 'react';
import { Dialog } from '@/components/primitives/dialog';
import { Button } from '@/components/primitives/button';
import { Input, Label, Select, FieldError } from '@/components/primitives/input';
import { useCreateCategory } from '@/features/categories/api';
import { ApiError } from '@/lib/api';
import type { Website } from '@/lib/types';

export function NewCategoryDialog({
  projectId,
  websites,
  open,
  onOpenChange,
}: {
  projectId: string;
  websites: Website[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateCategory(projectId);
  const [websiteId, setWebsiteId] = useState(websites[0]?.id ?? '');
  const [name, setName] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const website = websites.find((w) => w.id === websiteId) ?? websites[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        websiteId: websiteId || websites[0]?.id,
        name,
        sitemapUrl: sitemapUrl.trim() || undefined,
      });
      setName('');
      setSitemapUrl('');
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fieldErrors[0]?.message ?? err.message)
          : 'Unable to reach the server.',
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New category"
      description="A category is one sitemap of a website — crawled, scored and tracked on its own."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {websites.length > 1 && (
          <div>
            <Label htmlFor="cat-website">Website</Label>
            <Select
              id="cat-website"
              value={websiteId}
              onChange={(e) => setWebsiteId(e.target.value)}
            >
              {websites.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="cat-name">Name</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Model Pages"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="cat-sitemap">Sitemap URL</Label>
          <Input
            id="cat-sitemap"
            type="url"
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            placeholder={`${website?.origin ?? 'https://example.com'}/sitemap-models.xml`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'cat-sitemap-error' : 'cat-sitemap-hint'}
          />
          <FieldError id="cat-sitemap-error" message={error ?? undefined} />
          {!error && (
            <p id="cat-sitemap-hint" className="mt-1.5 text-xs text-muted">
              Optional now — you can add it later. Must be on {website?.origin}.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={name.trim().length < 2}>
            Create category
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
