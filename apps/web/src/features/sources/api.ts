import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@seo-guardian/shared';
import { apiFetch, uploadFile } from '@/lib/api';
import type { UrlSource } from '@/lib/types';

export const sourceKeys = {
  byWebsite: (websiteId: string) => ['sources', websiteId] as const,
};

export function useSources(websiteId: string | undefined) {
  return useQuery({
    queryKey: sourceKeys.byWebsite(websiteId ?? ''),
    queryFn: () => apiFetch<Paginated<UrlSource>>(`/websites/${websiteId}/sources`),
    enabled: !!websiteId,
  });
}

export type CreateSourceInput =
  | { type: 'manual'; urls: string[] }
  | { type: 'sitemap'; sitemapUrl: string }
  | { type: 'discovery'; seeds: string[]; maxDepth?: number; maxPages?: number };

export function useCreateSource(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSourceInput) =>
      apiFetch<UrlSource>(`/websites/${websiteId}/sources`, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sourceKeys.byWebsite(websiteId) }),
  });
}

export function useUploadCsvSource(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, urlColumn }: { file: File; urlColumn?: string }) => {
      const form = new FormData();
      form.append('file', file);
      if (urlColumn) form.append('urlColumn', urlColumn);
      return uploadFile<UrlSource>(`/websites/${websiteId}/sources/csv`, form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: sourceKeys.byWebsite(websiteId) }),
  });
}

export function useDeleteSource(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => apiFetch<void>(`/sources/${sourceId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sourceKeys.byWebsite(websiteId) }),
  });
}
