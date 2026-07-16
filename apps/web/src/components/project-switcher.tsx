'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useProjects } from '@/features/projects/api';
import { useDismissable } from '@/lib/use-dismissable';
import { IconChevronDown, IconFolder } from '@/components/icons';

export function ProjectSwitcher() {
  const params = useParams<{ slug?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : undefined;
  const { data } = useProjects();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissable(containerRef, open, () => setOpen(false));

  const projects = data?.data ?? [];
  const current = slug ? projects.find((project) => project.slug === slug) : undefined;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
      >
        <IconFolder className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1 truncate">{current ? current.name : 'All projects'}</span>
        <IconChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <Link
            href="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            All projects
          </Link>
          {projects.length > 0 && (
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          )}
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push(`/projects/${project.slug}`);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                project.slug === slug
                  ? 'font-semibold text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <span className="block truncate">{project.name}</span>
              <span className="block truncate font-mono text-xs text-slate-400 dark:text-slate-500">
                /{project.slug}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
