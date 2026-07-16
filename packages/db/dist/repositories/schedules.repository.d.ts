import type { Database } from '../database';
export interface ScheduleRow {
    id: string;
    websiteId: string;
    cron: string;
    timezone: string;
    mode: string;
    isActive: boolean;
    nextRunAt: Date | null;
    lastFiredAt: Date | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class SchedulesRepository {
    private readonly db;
    constructor(db: Database);
    findById(id: string): Promise<ScheduleRow | null>;
    listByWebsite(websiteId: string): Promise<ScheduleRow[]>;
    listAllActive(): Promise<ScheduleRow[]>;
    create(input: {
        websiteId: string;
        cron: string;
        timezone: string;
        mode: string;
        nextRunAt: Date | null;
        createdBy: string;
    }): Promise<ScheduleRow>;
    update(id: string, patch: {
        cron?: string;
        timezone?: string;
        mode?: string;
        isActive?: boolean;
        nextRunAt?: Date | null;
    }): Promise<ScheduleRow | null>;
    markFired(id: string, nextRunAt: Date | null): Promise<void>;
    delete(id: string): Promise<boolean>;
    websiteIdOf(scheduleId: string): Promise<string | null>;
}
