import { useQuery } from '@tanstack/react-query';
import type { Paginated } from '@seo-guardian/shared';
import { apiFetch } from '@/lib/api';
import type { CrawlChange, SchemaCoverage, SchemaEntity } from '@/lib/types';

export const schemaKeys = {
  coverage: (crawlId: string) => ['schema', crawlId, 'coverage'] as const,
  entities: (crawlId: string) => ['schema', crawlId, 'entities'] as const,
  rich: (crawlId: string) => ['schema', crawlId, 'rich'] as const,
  changes: (crawlId: string) => ['schema', crawlId, 'changes'] as const,
  history: (websiteId: string) => ['schema', 'history', websiteId] as const,
};

export function useSchemaCoverage(crawlId: string | undefined) {
  return useQuery({
    queryKey: schemaKeys.coverage(crawlId ?? ''),
    queryFn: () => apiFetch<SchemaCoverage>(`/crawls/${crawlId}/schema/coverage`),
    enabled: !!crawlId,
  });
}

export function useSchemaEntities(
  crawlId: string | undefined,
  filters?: { schemaType?: string; status?: string },
) {
  const qs = new URLSearchParams({ limit: '100' });
  if (filters?.schemaType) qs.set('schemaType', filters.schemaType);
  if (filters?.status) qs.set('status', filters.status);
  return useQuery({
    queryKey: [
      ...schemaKeys.entities(crawlId ?? ''),
      filters?.schemaType ?? '',
      filters?.status ?? '',
    ],
    queryFn: () => apiFetch<Paginated<SchemaEntity>>(`/crawls/${crawlId}/schema?${qs}`),
    enabled: !!crawlId,
  });
}

export function useRichResults(crawlId: string | undefined) {
  return useQuery({
    queryKey: schemaKeys.rich(crawlId ?? ''),
    queryFn: () =>
      apiFetch<Array<{ profile: string; status: string; count: number }>>(
        `/crawls/${crawlId}/schema/rich-results`,
      ),
    enabled: !!crawlId,
  });
}

export function useCrawlChanges(crawlId: string | undefined, changeType?: string) {
  const qs = new URLSearchParams({ limit: '100' });
  if (changeType) qs.set('changeType', changeType);
  return useQuery({
    queryKey: [...schemaKeys.changes(crawlId ?? ''), changeType ?? ''],
    queryFn: () => apiFetch<Paginated<CrawlChange>>(`/crawls/${crawlId}/changes?${qs}`),
    enabled: !!crawlId,
  });
}

export function useChangesSummary(crawlId: string | undefined) {
  return useQuery({
    queryKey: [...schemaKeys.changes(crawlId ?? ''), 'summary'],
    queryFn: () =>
      apiFetch<Array<{ changeType: string; count: number }>>(`/crawls/${crawlId}/changes/summary`),
    enabled: !!crawlId,
  });
}

export function useSchemaHistory(websiteId: string | undefined) {
  return useQuery({
    queryKey: schemaKeys.history(websiteId ?? ''),
    queryFn: () =>
      apiFetch<{ data: Array<{ crawlId: string; date: string; schema: unknown }> }>(
        `/websites/${websiteId}/schema/history`,
      ),
    enabled: !!websiteId,
  });
}
