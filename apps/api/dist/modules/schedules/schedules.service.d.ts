import { SchedulesRepository, WebsitesRepository } from '@seo-guardian/db';
import type { ScheduleRow } from '@seo-guardian/db';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import type { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto';
interface ActorContext {
    actor: AuthUser;
    ip: string | null;
}
export declare class SchedulesService {
    private readonly schedules;
    private readonly websites;
    private readonly jobs;
    private readonly audit;
    constructor(schedules: SchedulesRepository, websites: WebsitesRepository, jobs: JobsService, audit: AuditService);
    list(websiteId: string): Promise<ScheduleRow[]>;
    create(websiteId: string, dto: CreateScheduleDto, ctx: ActorContext): Promise<ScheduleRow>;
    update(scheduleId: string, dto: UpdateScheduleDto, ctx: ActorContext): Promise<ScheduleRow>;
    delete(scheduleId: string, ctx: ActorContext): Promise<void>;
    private getById;
    private recordAudit;
}
export {};
