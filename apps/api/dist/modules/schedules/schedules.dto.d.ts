import { CrawlMode } from '@seo-guardian/shared';
export declare class CreateScheduleDto {
    preset?: 'daily' | 'every_6_hours' | 'weekly' | 'monthly';
    cron?: string;
    timezone?: string;
    mode?: CrawlMode;
}
export declare class UpdateScheduleDto extends CreateScheduleDto {
    isActive?: boolean;
}
export declare class ScheduleResponseDto {
    id: string;
    websiteId: string;
    cron: string;
    timezone: string;
    mode: string;
    isActive: boolean;
    nextRunAt: Date | null;
    lastFiredAt: Date | null;
}
