export declare function assertValidTimezone(timezone: string): void;
/**
 * Resolves a preset or raw cron into a validated cron expression and computes
 * the next run. Rejects expressions firing more often than every 5 minutes.
 */
export declare function resolveCron(input: {
    preset?: string;
    cron?: string;
    timezone: string;
}): {
    cron: string;
    nextRunAt: Date;
};
