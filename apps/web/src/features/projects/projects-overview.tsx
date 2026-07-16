'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/features/projects/api';
import { NewProjectModal } from '@/features/projects/new-project-modal';
import { QueryBoundary, EmptyState } from '@/components/feedback/query-boundary';
import { CardSkeleton } from '@/components/primitives/skeleton';
import { Button } from '@/components/primitives/button';
import { IconFolder, IconPlus } from '@/components/icons';
import { formatDate } from '@/utils/format';

export function ProjectsOverview() {
  const projects = useProjects();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Projects</h1>
          <p className="mt-0.5 text-sm text-muted">Everything your team monitors, in one place.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <IconPlus className="h-4 w-4" /> New project
        </Button>
      </div>

      <QueryBoundary
        query={projects}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        }
        isEmpty={(d) => d.data.length === 0}
        empty={
          <EmptyState
            icon={<IconFolder className="h-8 w-8" />}
            title="No projects yet"
            description="Create your first project to start monitoring a site's SEO health."
            action={
              <Button onClick={() => setModalOpen(true)}>
                <IconPlus className="h-4 w-4" /> New project
              </Button>
            }
          />
        }
      >
        {(data) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.data.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary"
              >
                <p className="truncate font-semibold text-text">{project.name}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-muted">/{project.slug}</p>
                <p className="mt-3 text-xs text-faint">Created {formatDate(project.createdAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </QueryBoundary>

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
