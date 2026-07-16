import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@seo-guardian/shared';
import { apiFetch } from '@/lib/api';
import type { Website } from '@/lib/types';

export const websiteKeys = {
  byProject: (projectId: string) => ['websites', 'project', projectId] as const,
  detail: (websiteId: string) => ['websites', 'detail', websiteId] as const,
};

export function useWebsites(projectId: string | undefined) {
  return useQuery({
    queryKey: websiteKeys.byProject(projectId ?? ''),
    queryFn: () => apiFetch<Paginated<Website>>(`/projects/${projectId}/websites`),
    enabled: !!projectId,
  });
}

export function useWebsite(websiteId: string | undefined) {
  return useQuery({
    queryKey: websiteKeys.detail(websiteId ?? ''),
    queryFn: () => apiFetch<Website>(`/websites/${websiteId}`),
    enabled: !!websiteId,
  });
}

export interface CreateWebsiteInput {
  name: string;
  origin: string;
  pathScope?: string;
}

export function useCreateWebsite(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWebsiteInput) =>
      apiFetch<Website>(`/projects/${projectId}/websites`, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: websiteKeys.byProject(projectId) }),
  });
}

export function useUpdateWebsite(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: {
      name?: string;
      isActive?: boolean;
      settings?: Record<string, unknown>;
    }) => apiFetch<Website>(`/websites/${websiteId}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: websiteKeys.detail(websiteId) }),
  });
}

export function useDeleteWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (websiteId: string) =>
      apiFetch<void>(`/websites/${websiteId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['websites'] }),
  });
}
