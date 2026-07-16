'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProjectBySlug } from '@/features/projects/api';
import { useWebsites } from '@/features/websites/api';
import { useCategories } from '@/features/categories/api';
import { CategoryCard } from '@/features/categories/category-card';
import { NewCategoryDialog } from '@/features/categories/new-category-dialog';
import { NewWebsiteModal } from '@/features/websites/new-website-modal';
import { QueryBoundary, EmptyState } from '@/components/feedback/query-boundary';
import { CardSkeleton } from '@/components/primitives/skeleton';
import { Button } from '@/components/primitives/button';
import { IconFolder, IconPlus } from '@/components/icons';

/**
 * The project dashboard: one card per sitemap category. This is the primary
 * screen of the app — everything else is reached from here.
 */
export default function ProjectPage() {
  const params = useParams<{ slug: string }>();
  const { project } = useProjectBySlug(params.slug);
  const categories = useCategories(project?.id);
  const websites = useWebsites(project?.id);
  const [newCategory, setNewCategory] = useState(false);
  const [newWebsite, setNewWebsite] = useState(false);

  const hasWebsite = (websites.data?.data.length ?? 0) > 0;
  const totalUrls = (categories.data?.data ?? []).reduce((sum, g) => sum + g.totalUrls, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            {project?.name ?? params.slug}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {categories.data
              ? `${categories.data.data.length} ${
                  categories.data.data.length === 1 ? 'category' : 'categories'
                } · ${totalUrls.toLocaleString()} URLs`
              : 'Sitemap categories monitored in this project.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setNewWebsite(true)}>
            Add website
          </Button>
          <Button size="sm" onClick={() => setNewCategory(true)} disabled={!hasWebsite}>
            <IconPlus className="h-4 w-4" /> New category
          </Button>
        </div>
      </div>

      <QueryBoundary
        query={categories}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        }
        isEmpty={(d) => d.data.length === 0}
        empty={
          hasWebsite ? (
            <EmptyState
              icon={<IconFolder className="h-8 w-8" />}
              title="No categories yet"
              description="A category is one sitemap — Model Pages, Compare Pages, News. Add one to crawl and track it independently."
              action={
                <Button onClick={() => setNewCategory(true)}>
                  <IconPlus className="h-4 w-4" /> New category
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconFolder className="h-8 w-8" />}
              title="Add a website first"
              description="Categories belong to a website. Add the site you want to monitor, then split it into sitemap categories."
              action={<Button onClick={() => setNewWebsite(true)}>Add website</Button>}
            />
          )
        }
      >
        {(data) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.data.map((group) => (
              <CategoryCard key={group.id} group={group} projectSlug={params.slug} />
            ))}
          </div>
        )}
      </QueryBoundary>

      {websites.data && websites.data.data.length > 0 && (
        <p className="mt-6 text-xs text-muted">
          Websites:{' '}
          {websites.data.data.map((w, i) => (
            <span key={w.id}>
              {i > 0 && ' · '}
              <Link href={`/websites/${w.id}`} className="hover:text-primary hover:underline">
                {w.name}
              </Link>
            </span>
          ))}
        </p>
      )}

      {project && (
        <>
          <NewCategoryDialog
            projectId={project.id}
            websites={websites.data?.data ?? []}
            open={newCategory}
            onOpenChange={setNewCategory}
          />
          <NewWebsiteModal
            projectId={project.id}
            open={newWebsite}
            onClose={() => setNewWebsite(false)}
            onCreated={() => setNewWebsite(false)}
          />
        </>
      )}
    </div>
  );
}
