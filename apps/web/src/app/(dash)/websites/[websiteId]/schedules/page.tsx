'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
} from '@/features/schedules/api';
import { Section, Card, QueryBoundary, EmptyState } from '@/components/ui';
import { StatusBadge } from '@/components/badges';
import { inputClasses, labelClasses, primaryButtonClasses } from '@/components/form';
import type { Schedule } from '@/lib/types';

const PRESETS = [
  { value: 'daily', label: 'Daily (03:00)' },
  { value: 'every_6_hours', label: 'Every 6 hours' },
  { value: 'weekly', label: 'Weekly (Mon 03:00)' },
  { value: 'monthly', label: 'Monthly (1st, 03:00)' },
] as const;

function fmt(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
}

export default function SchedulesPage() {
  const params = useParams<{ websiteId: string }>();
  const websiteId = params.websiteId;
  const schedules = useSchedules(websiteId);
  const create = useCreateSchedule(websiteId);
  const update = useUpdateSchedule(websiteId);
  const del = useDeleteSchedule(websiteId);

  const [preset, setPreset] = useState<(typeof PRESETS)[number]['value']>('daily');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [mode, setMode] = useState<'full' | 'incremental'>('incremental');

  return (
    <div className="space-y-8">
      <Section title="Crawl schedules" description="Automatic crawls on a recurring schedule.">
        <QueryBoundary
          query={schedules}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <EmptyState
              title="No schedules"
              description="Add a schedule below to crawl automatically."
            />
          }
        >
          {(data) => (
            <div className="space-y-2">
              {data.data.map((s: Schedule) => (
                <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={s.isActive ? 'running' : 'paused'}>
                      {s.isActive ? 'active' : 'paused'}
                    </StatusBadge>
                    <span className="font-mono text-sm">{s.cron}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {s.timezone} · {s.mode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                      next {fmt(s.nextRunAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => update.mutate({ id: s.id, patch: { isActive: !s.isActive } })}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {s.isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      onClick={() => del.mutate(s.id)}
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </QueryBoundary>
      </Section>

      <Section title="Add a schedule">
        <Card className="max-w-xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="preset" className={labelClasses}>
                Frequency
              </label>
              <select
                id="preset"
                className={inputClasses}
                value={preset}
                onChange={(e) => setPreset(e.target.value as typeof preset)}
              >
                {PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tz" className={labelClasses}>
                Timezone (IANA)
              </label>
              <input
                id="tz"
                className={inputClasses}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="mode" className={labelClasses}>
                Mode
              </label>
              <select
                id="mode"
                className={inputClasses}
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="incremental">Incremental</option>
                <option value="full">Full</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate({ preset, timezone: timezone.trim(), mode })}
            className={`${primaryButtonClasses} mt-4`}
          >
            {create.isPending ? 'Adding…' : 'Add schedule'}
          </button>
          {create.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {(create.error as Error).message}
            </p>
          )}
        </Card>
      </Section>
    </div>
  );
}
