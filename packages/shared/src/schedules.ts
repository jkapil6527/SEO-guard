/**
 * Schedule presets map UI choices to cron expressions. "Manual" is intentionally
 * absent: a manual crawl is an on-demand action, not a schedule row.
 */
export const SCHEDULE_PRESETS = {
  daily: '0 3 * * *',
  every_6_hours: '0 */6 * * *',
  weekly: '0 3 * * 1',
  monthly: '0 3 1 * *',
} as const;

export type SchedulePreset = keyof typeof SCHEDULE_PRESETS;

export function isSchedulePreset(value: string): value is SchedulePreset {
  return Object.prototype.hasOwnProperty.call(SCHEDULE_PRESETS, value);
}

export function presetToCron(preset: SchedulePreset): string {
  return SCHEDULE_PRESETS[preset];
}
