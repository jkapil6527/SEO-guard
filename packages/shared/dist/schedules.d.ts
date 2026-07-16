/**
 * Schedule presets map UI choices to cron expressions. "Manual" is intentionally
 * absent: a manual crawl is an on-demand action, not a schedule row.
 */
export declare const SCHEDULE_PRESETS: {
    readonly daily: "0 3 * * *";
    readonly every_6_hours: "0 */6 * * *";
    readonly weekly: "0 3 * * 1";
    readonly monthly: "0 3 1 * *";
};
export type SchedulePreset = keyof typeof SCHEDULE_PRESETS;
export declare function isSchedulePreset(value: string): value is SchedulePreset;
export declare function presetToCron(preset: SchedulePreset): string;
