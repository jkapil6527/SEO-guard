import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@seo-guardian/shared';
import { apiFetch } from '@/lib/api';
import type { Crawl, CrawlReport, CrawlScope, Issue, IssueSummary, PageSnapshot } from '@/lib/types';

export const crawlKeys = {
  history: (websiteId: string) => ['crawls', 'history', websiteId] as const,
  reports: (projectId?: string) => ['crawls', 'reports', projectId ?? 'all'] as const,
  detail: (crawlId: string) => ['crawls', 'detail', crawlId] as const,
  pages: (crawlId: string) => ['crawls', crawlId, 'pages'] as const,
  page: (crawlId: string, pageId: string) => ['crawls', crawlId, 'page', pageId] as const,
  issues: (crawlId: string) => ['crawls', crawlId, 'issues'] as const,
  issueSummary: (crawlId: string) => ['crawls', crawlId, 'issues', 'summary'] as const,
};

/**
 * Every crawl across the workspace, newest first. Polls while any crawl is still
 * running so the Reports feed reflects in-flight work without a manual refresh.
 */
export function useCrawlReports(projectId?: string) {
  const qs = new URLSearchParams({ limit: '100' });
  if (projectId) qs.set('projectId', projectId);
  return useQuery({
    queryKey: crawlKeys.reports(projectId),
    queryFn: () => apiFetch<Paginated<CrawlReport>>(`/crawls?${qs}`),
    refetchInterval: (query) => {
      const rows = query.state.data?.data ?? [];
      const active = rows.some((c) =>
        ['queued', 'resolving', 'running', 'paused', 'finalizing'].includes(c.status),
      );
      return active ? 4000 : false;
    },
  });
}

export function useCrawlHistory(websiteId: string | undefined) {
  return useQuery({
    queryKey: crawlKeys.history(websiteId ?? ''),
    queryFn: () => apiFetch<Paginated<Crawl>>(`/websites/${websiteId}/crawls?limit=50`),
    enabled: !!websiteId,
  });
}

/** Crawl status; polls while the crawl is active so the UI stays live even without SSE. */
export function useCrawl(crawlId: string | undefined, activePoll = false) {
  return useQuery({
    queryKey: crawlKeys.detail(crawlId ?? ''),
    queryFn: () => apiFetch<CrawlReport>(`/crawls/${crawlId}`),
    enabled: !!crawlId,
    refetchInterval: activePoll ? 2000 : false,
  });
}

export interface StartCrawlInput {
  mode: 'full' | 'incremental';
  /** 'page' crawls only `url`; 'site' (the default) walks the website's sources. */
  scope?: CrawlScope;
  url?: string;
}

export function useStartCrawl(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartCrawlInput) =>
      apiFetch<{ crawlId: string; status: string }>(`/websites/${websiteId}/crawls`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: crawlKeys.history(websiteId) });
      // Prefix match, so every project-filtered Reports feed refreshes too.
      await qc.invalidateQueries({ queryKey: ['crawls', 'reports'] });
    },
  });
}

export function useCrawlControl(crawlId: string, websiteId: string) {
  const qc = useQueryClient();
  const run = (action: 'pause' | 'resume' | 'cancel' | 'retry-failed') =>
    apiFetch<unknown>(`/crawls/${crawlId}/${action}`, { method: 'POST' });
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: crawlKeys.detail(crawlId) });
      await qc.invalidateQueries({ queryKey: crawlKeys.history(websiteId) });
    },
  });
}

export function useCrawlPages(crawlId: string | undefined, fetchStatus?: string) {
  const qs = new URLSearchParams({ limit: '100' });
  if (fetchStatus) qs.set('fetchStatus', fetchStatus);
  return useQuery({
    queryKey: [...crawlKeys.pages(crawlId ?? ''), fetchStatus ?? 'all'],
    queryFn: () => apiFetch<Paginated<PageSnapshot>>(`/crawls/${crawlId}/pages?${qs}`),
    enabled: !!crawlId,
  });
}

export function useCrawlPage(crawlId: string | undefined, pageId: string | undefined) {
  return useQuery({
    queryKey: crawlKeys.page(crawlId ?? '', pageId ?? ''),
    queryFn: () =>
      apiFetch<{ snapshot: PageSnapshot; issues: Issue[] }>(`/crawls/${crawlId}/pages/${pageId}`),
    enabled: !!crawlId && !!pageId,
  });
}

export function useCrawlIssues(
  crawlId: string | undefined,
  filters?: { severity?: string[]; checkId?: string },
) {
  const qs = new URLSearchParams({ limit: '100' });
  if (filters?.severity?.length) qs.set('severity', filters.severity.join(','));
  if (filters?.checkId) qs.set('checkId', filters.checkId);
  return useQuery({
    queryKey: [
      ...crawlKeys.issues(crawlId ?? ''),
      filters?.severity?.join(',') ?? '',
      filters?.checkId ?? '',
    ],
    queryFn: () => apiFetch<Paginated<Issue>>(`/crawls/${crawlId}/issues?${qs}`),
    enabled: !!crawlId,
  });
}

export function useIssueSummary(crawlId: string | undefined) {
  return useQuery({
    queryKey: crawlKeys.issueSummary(crawlId ?? ''),
    queryFn: () => apiFetch<IssueSummary>(`/crawls/${crawlId}/issues/summary`),
    enabled: !!crawlId,
  });
}
