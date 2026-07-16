'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebsite, useUpdateWebsite, useDeleteWebsite } from '@/features/websites/api';
import { Section, Card, QueryBoundary } from '@/components/ui';
import { inputClasses, labelClasses, primaryButtonClasses } from '@/components/form';

export default function WebsiteSettingsPage() {
  const params = useParams<{ websiteId: string }>();
  const websiteId = params.websiteId;
  const router = useRouter();
  const website = useWebsite(websiteId);
  const update = useUpdateWebsite(websiteId);
  const del = useDeleteWebsite();

  const [name, setName] = useState('');
  const [renderPolicy, setRenderPolicy] = useState<'auto' | 'never' | 'always'>('auto');

  useEffect(() => {
    if (website.data) {
      setName(website.data.name);
      const rp = (website.data.settings as { renderPolicy?: string }).renderPolicy;
      if (rp === 'never' || rp === 'always' || rp === 'auto') setRenderPolicy(rp);
    }
  }, [website.data]);

  return (
    <QueryBoundary query={website}>
      {(data) => (
        <div className="space-y-8">
          <Section title="Website settings">
            <Card className="max-w-xl space-y-4">
              <div>
                <label htmlFor="name" className={labelClasses}>
                  Name
                </label>
                <input
                  id="name"
                  className={inputClasses}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClasses}>Origin</label>
                <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">
                  {data.origin}
                </p>
              </div>
              <div>
                <label htmlFor="rp" className={labelClasses}>
                  JavaScript rendering
                </label>
                <select
                  id="rp"
                  className={inputClasses}
                  value={renderPolicy}
                  onChange={(e) => setRenderPolicy(e.target.value as typeof renderPolicy)}
                >
                  <option value="auto">Auto — render only pages that need JS</option>
                  <option value="never">Never — static HTML only (fastest)</option>
                  <option value="always">Always — render every page</option>
                </select>
              </div>
              <button
                type="button"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    name: name.trim(),
                    settings: { ...data.settings, renderPolicy },
                  })
                }
                className={primaryButtonClasses}
              >
                {update.isPending ? 'Saving…' : 'Save changes'}
              </button>
              {update.isSuccess && (
                <span className="ml-3 text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>
              )}
            </Card>
          </Section>

          <Section title="Danger zone">
            <Card className="max-w-xl border-red-200 dark:border-red-900">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Deleting a website permanently removes it and all of its crawl history.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${data.name}" and all its crawls? This cannot be undone.`)) {
                    del.mutate(websiteId, {
                      onSuccess: () => router.push(`/`),
                    });
                  }
                }}
                className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete website
              </button>
            </Card>
          </Section>
        </div>
      )}
    </QueryBoundary>
  );
}
