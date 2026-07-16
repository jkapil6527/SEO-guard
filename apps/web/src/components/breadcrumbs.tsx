'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { useProjectBySlug } from '@/features/projects/api';
import { useCategory } from '@/features/categories/api';
import { IconChevronRight } from '@/components/icons';

const SECTION_LABELS: Record<string, string> = {
  categories: 'Categories',
  urls: 'URLs',
  crawls: 'Crawls',
  pages: 'Pages',
  issues: 'Issues',
  schema: 'Schema',
  changes: 'Changes',
  sources: 'Sources',
  schedules: 'Schedules',
  settings: 'Settings',
  reports: 'Reports',
  compare: 'Compare',
};

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Builds a trail for every route. The previous version only handled /reports and
 * /projects/[slug], so /websites/* and /crawls/* — most of the app — showed a
 * bare "Projects" and no way back.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const params = useParams<{ slug?: string; groupId?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : undefined;
  const groupId = typeof params.groupId === 'string' ? params.groupId : undefined;

  const { project } = useProjectBySlug(slug);
  const category = useCategory(groupId);

  const crumbs: Crumb[] = [{ label: 'Projects', href: '/' }];
  const segments = pathname.split('/').filter(Boolean);

  if (pathname === '/') {
    crumbs[0] = { label: 'Projects' };
  } else if (segments[0] === 'reports') {
    crumbs.push({ label: 'Reports' });
  } else if (segments[0] === 'projects' && slug) {
    const projectHref = `/projects/${slug}`;
    const inCategory = segments[2] === 'categories' && groupId;

    crumbs.push(
      inCategory || segments.length > 2
        ? { label: project?.name ?? slug, href: projectHref }
        : { label: project?.name ?? slug },
    );

    if (inCategory) {
      const catHref = `${projectHref}/categories/${groupId}`;
      const tail = segments[4];
      crumbs.push(
        tail
          ? { label: category.data?.name ?? 'Category', href: catHref }
          : { label: category.data?.name ?? 'Category' },
      );
      if (tail) crumbs.push({ label: SECTION_LABELS[tail] ?? tail });
    } else if (segments[2]) {
      crumbs.push({ label: SECTION_LABELS[segments[2]] ?? segments[2] });
    }
  } else if (segments[0] === 'websites') {
    crumbs.push({ label: 'Website', href: `/websites/${segments[1]}` });
    if (segments[2]) crumbs.push({ label: SECTION_LABELS[segments[2]] ?? segments[2] });
  } else if (segments[0] === 'crawls') {
    crumbs.push({ label: 'Crawl', href: `/crawls/${segments[1]}` });
    if (segments[2]) crumbs.push({ label: SECTION_LABELS[segments[2]] ?? segments[2] });
  } else if (segments[0] === 'urls') {
    crumbs.push({ label: 'URL report' });
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && (
              <li aria-hidden="true">
                <IconChevronRight className="h-3.5 w-3.5 text-faint" />
              </li>
            )}
            <li className="min-w-0">
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="block truncate text-muted transition-colors hover:text-text"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="block truncate font-medium text-text">
                  {crumb.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
