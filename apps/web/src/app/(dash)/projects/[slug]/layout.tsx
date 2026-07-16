'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProjectBySlug } from '@/features/projects/api';
import { secondaryButtonClasses } from '@/components/form';
import { IconFolder, IconSpinner } from '@/components/icons';

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ slug: string }>();
  const { query, project } = useProjectBySlug(params.slug);

  if (query.isPending) {
    return (
      <div role="status" className="flex min-h-[50vh] items-center justify-center text-slate-400">
        <IconSpinner className="h-6 w-6" />
        <span className="sr-only">Loading project…</span>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      >
        Could not load this project: {query.error.message}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <IconFolder className="mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
        <h1 className="text-lg font-semibold">Project not found</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          No project with the slug <span className="font-mono">/{params.slug}</span> is visible to
          you.
        </p>
        <Link href="/" className={`mt-5 ${secondaryButtonClasses}`}>
          Back to projects
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
