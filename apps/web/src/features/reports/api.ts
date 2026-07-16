import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { DuplicateGroup, IssueDetail, PageSnapshot, SchemaEntity } from '@/lib/types';

export const reportKeys = {
  page: (crawlId: string, pageId: string) => ['report', crawlId, pageId] as const,
  schema: (crawlId: string, pageId: string) => ['report', crawlId, pageId, 'schema'] as const,
  duplicates: (crawlId: string) => ['report', crawlId, 'duplicates'] as const,
};

/** The URL report: snapshot + fully-explained issues (location, why, impact, fix). */
export function usePageReport(crawlId: string | undefined, pageId: string | undefined) {
  return useQuery({
    queryKey: reportKeys.page(crawlId ?? '', pageId ?? ''),
    queryFn: () =>
      apiFetch<{
        snapshot: PageSnapshot;
        issues: IssueDetail[];
        duplicates: DuplicateGroup[];
      }>(`/crawls/${crawlId}/pages/${pageId}`),
    enabled: !!crawlId && !!pageId,
    // A completed crawl's snapshot is immutable — never re-fetch it.
    staleTime: Infinity,
  });
}

export function usePageSchema(crawlId: string | undefined, pageId: string | undefined) {
  return useQuery({
    queryKey: reportKeys.schema(crawlId ?? '', pageId ?? ''),
    queryFn: () =>
      apiFetch<{ data: SchemaEntity[] }>(`/crawls/${crawlId}/pages/${pageId}/schema`),
    enabled: !!crawlId && !!pageId,
    staleTime: Infinity,
  });
}

export function useCrawlDuplicates(crawlId: string | undefined, field?: string) {
  const qs = field ? `?field=${field}` : '';
  return useQuery({
    queryKey: [...reportKeys.duplicates(crawlId ?? ''), field ?? 'all'],
    queryFn: () => apiFetch<{ data: DuplicateGroup[] }>(`/crawls/${crawlId}/duplicates${qs}`),
    enabled: !!crawlId,
  });
}
