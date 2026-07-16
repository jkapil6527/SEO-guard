'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ProjectSwitcher } from '@/components/project-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { useProjectBySlug } from '@/features/projects/api';
import { useCategories } from '@/features/categories/api';
import { cn } from '@/utils/cn';
import { IconChart, IconFolder, IconGrid, IconMenu, IconShield, IconX } from '@/components/icons';
import type { IconProps } from '@/components/icons';

interface NavItem {
  label: string;
  href: string;
  icon: (props: IconProps) => ReactNode;
  exact?: boolean;
}

const ACTIVE = ['queued', 'resolving', 'running', 'paused', 'finalizing'];

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary-soft text-primary'
          : 'text-muted hover:bg-surface-hover hover:text-text',
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      {item.label}
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-faint uppercase">
      {children}
    </p>
  );
}

function SidebarContent({
  onNavigate,
  onClose,
}: {
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const params = useParams<{ slug?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : undefined;

  // The sidebar is contextual: inside a project it lists that project's
  // categories, with a live dot for whichever is crawling.
  const { project } = useProjectBySlug(slug);
  const categories = useCategories(project?.id);

  const workspaceNav: NavItem[] = [
    { label: 'Projects', href: '/', icon: IconFolder, exact: true },
    { label: 'Reports', href: '/reports', icon: IconChart },
  ];

  return (
    <div className="flex h-full flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
          <IconShield className="h-5 w-5" />
        </span>
        <span className="flex-1 text-sm font-semibold tracking-tight text-text">SEO Guardian</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-1 text-muted hover:bg-surface-hover lg:hidden"
          >
            <IconX className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="border-b border-border px-3 pb-3">
        <ProjectSwitcher />
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto p-3">
        <div>
          <SectionLabel>Workspace</SectionLabel>
          <div className="space-y-0.5">
            {workspaceNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        </div>

        {slug && (categories.data?.data.length ?? 0) > 0 && (
          <div>
            <SectionLabel>Categories</SectionLabel>
            <div className="space-y-0.5">
              {categories.data?.data.map((group) => {
                const href = `/projects/${slug}/categories/${group.id}`;
                const active = pathname.startsWith(href);
                const crawling =
                  !!group.lastCrawlStatus && ACTIVE.includes(group.lastCrawlStatus);
                return (
                  <Link
                    key={group.id}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-primary-soft font-medium text-primary'
                        : 'text-muted hover:bg-surface-hover hover:text-text',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        crawling
                          ? 'animate-pulse bg-primary'
                          : group.lastCrawlStatus === 'completed'
                            ? 'bg-success'
                            : group.lastCrawlStatus === 'failed'
                              ? 'bg-danger'
                              : 'bg-border-strong',
                      )}
                    />
                    <span className="truncate">{group.name}</span>
                    {crawling && <span className="sr-only">(crawling)</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-fg"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">
        <SidebarContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-60">
            <SidebarContent
              onNavigate={() => setDrawerOpen(false)}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-2 text-muted hover:bg-surface-hover lg:hidden"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <Breadcrumbs />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        {/* Data tables need the width; the old shell capped every page at 1152px. */}
        <main id="main" className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
