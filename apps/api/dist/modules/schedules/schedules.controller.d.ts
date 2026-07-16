import type { AuthUser } from '../../common/auth-user';
import { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto';
import { SchedulesService } from './schedules.service';
export declare class SchedulesController {
    private readonly schedulesService;
    constructor(schedulesService: SchedulesService);
    list(websiteId: string): Promise<{
        data: import("@seo-guardian/db").ScheduleRow[];
        meta: {
            nextCursor: null;
        };
    }>;
    create(websiteId: string, dto: CreateScheduleDto, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").ScheduleRow>;
    update(scheduleId: string, dto: UpdateScheduleDto, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").ScheduleRow>;
    remove(scheduleId: string, actor: AuthUser, ip: string): Promise<void>;
}
