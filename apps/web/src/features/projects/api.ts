import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@seo-guardian/shared';
import { apiFetch } from '@/lib/api';
import type { Project } from '@/lib/types';

export const projectKeys = {
  all: ['projects'] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: () => apiFetch<Paginated<Project>>('/projects'),
  });
}

export function useProjectBySlug(slug: string | undefined) {
  const query = useProjects();
  const project = slug ? query.data?.data.find((candidate) => candidate.slug === slug) : undefined;
  return { query, project };
}

export interface CreateProjectInput {
  name: string;
  slug: string;
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiFetch<Project>('/projects', { method: 'POST', body: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
