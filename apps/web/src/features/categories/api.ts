import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import type { SitemapGroup, SitemapGroupSummary, SitemapPreview } from '@/lib/types';

export const categoryKeys = {
  all: ['categories'] as const,
  byProject: (projectId: string) => ['categories', 'project', projectId] as const,
  detail: (groupId: string) => ['categories', 'detail', groupId] as const,
  trend: (groupId: string) => ['categories', 'trend', groupId] as const,
};

const ACTIVE = ['queued', 'resolving', 'running', 'paused', 'finalizing'];

/**
 * Every category of a project with its dashboard rollup. Polls while any
 * category is crawling, so the cards stay live without a manual refresh.
 */
export function useCategories(projectId: string | undefined) {
  return useQuery({
    queryKey: categoryKeys.byProject(projectId ?? ''),
    queryFn: () =>
      apiFetch<{ data: SitemapGroupSummary[] }>(`/projects/${projectId}/sitemap-groups`),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const rows = query.state.data?.data ?? [];
      return rows.some((g) => g.lastCrawlStatus && ACTIVE.includes(g.lastCrawlStatus))
        ? 3000
        : false;
    },
  });
}

export function useCategory(groupId: string | undefined) {
  return useQuery({
    queryKey: categoryKeys.detail(groupId ?? ''),
    queryFn: () => apiFetch<SitemapGroup>(`/sitemap-groups/${groupId}`),
    enabled: !!groupId,
  });
}

export function useCategoryTrend(groupId: string | undefined) {
  return useQuery({
    queryKey: categoryKeys.trend(groupId ?? ''),
    queryFn: () =>
      apiFetch<{ data: Array<{ day: string; seoScore: string }> }>(
        `/sitemap-groups/${groupId}/trend`,
      ),
    enabled: !!groupId,
  });
}

export function useCreateCategory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { websiteId: string; name: string; sitemapUrl?: string }) =>
      apiFetch<SitemapGroup>(`/projects/${projectId}/sitemap-groups`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: async (group) => {
      toast.success(`Category “${group.name}” created`);
      await qc.invalidateQueries({ queryKey: categoryKeys.byProject(projectId) });
    },
    onError: (err) => toast.error(messageOf(err)),
  });
}

export function useUpdateCategory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      ...patch
    }: {
      groupId: string;
      name?: string;
      sitemapUrl?: string;
      isActive?: boolean;
    }) => apiFetch<SitemapGroup>(`/sitemap-groups/${groupId}`, { method: 'PATCH', body: patch }),
    onSuccess: async () => {
      toast.success('Category updated');
      await qc.invalidateQueries({ queryKey: categoryKeys.byProject(projectId) });
    },
    onError: (err) => toast.error(messageOf(err)),
  });
}

export function useDeleteCategory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) =>
      apiFetch<void>(`/sitemap-groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Category deleted');
      await qc.invalidateQueries({ queryKey: categoryKeys.byProject(projectId) });
    },
    onError: (err) => toast.error(messageOf(err)),
  });
}

/** Parse the sitemap and report what it holds — no crawl is started. */
export function usePreviewSitemap(groupId: string) {
  return useMutation({
    mutationFn: (sitemapUrl?: string) =>
      apiFetch<SitemapPreview>(`/sitemap-groups/${groupId}/preview`, {
        method: 'POST',
        body: sitemapUrl ? { sitemapUrl } : {},
      }),
  });
}

export function useStartCategoryCrawl(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, mode }: { groupId: string; mode: 'full' | 'incremental' }) =>
      apiFetch<{ crawlId: string; status: string }>(`/sitemap-groups/${groupId}/crawls`, {
        method: 'POST',
        body: { mode },
      }),
    onSuccess: async () => {
      toast.success('Crawl started');
      await qc.invalidateQueries({ queryKey: categoryKeys.byProject(projectId) });
      await qc.invalidateQueries({ queryKey: ['crawls', 'reports'] });
    },
    onError: (err) => toast.error(messageOf(err)),
  });
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}
