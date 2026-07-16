import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@seo-guardian/shared';
import { apiFetch } from '@/lib/api';
import type { Schedule } from '@/lib/types';

export const scheduleKeys = {
  byWebsite: (websiteId: string) => ['schedules', websiteId] as const,
};

export function useSchedules(websiteId: string | undefined) {
  return useQuery({
    queryKey: scheduleKeys.byWebsite(websiteId ?? ''),
    queryFn: () => apiFetch<Paginated<Schedule>>(`/websites/${websiteId}/schedules`),
    enabled: !!websiteId,
  });
}

export interface CreateScheduleInput {
  preset?: 'daily' | 'every_6_hours' | 'weekly' | 'monthly';
  cron?: string;
  timezone?: string;
  mode?: 'full' | 'incremental';
}

export function useCreateSchedule(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateScheduleInput) =>
      apiFetch<Schedule>(`/websites/${websiteId}/schedules`, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.byWebsite(websiteId) }),
  });
}

export function useUpdateSchedule(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<CreateScheduleInput> & { isActive?: boolean };
    }) => apiFetch<Schedule>(`/schedules/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.byWebsite(websiteId) }),
  });
}

export function useDeleteSchedule(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.byWebsite(websiteId) }),
  });
}
