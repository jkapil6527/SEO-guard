'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useWebsite } from '@/features/websites/api';
import { TabNav } from '@/components/tab-nav';
import { IconGlobe, IconSpinner } from '@/components/icons';

export default function WebsiteLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ websiteId: string }>();
  const website = useWebsite(params.websiteId);
  const base = `/websites/${params.websiteId}`;

  const tabs = [
    { label: 'Overview', href: base, exact: true },
    { label: 'Crawls', href: `${base}/crawls` },
    { label: 'Sources', href: `${base}/sources` },
    { label: 'Schedules', href: `${base}/schedules` },
    { label: 'Settings', href: `${base}/settings` },
  ];

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
          <IconGlobe className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          {website.isPending ? (
            <span className="flex items-center gap-2 text-slate-400">
              <IconSpinner className="h-4 w-4" /> Loading…
            </span>
          ) : (
            <>
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {website.data?.name ?? 'Website'}
              </h1>
              <p className="truncate font-mono text-sm text-slate-500 dark:text-slate-400">
                {website.data?.origin}
              </p>
            </>
          )}
        </div>
      </div>
      <TabNav tabs={tabs} />
      {children}
    </div>
  );
}
