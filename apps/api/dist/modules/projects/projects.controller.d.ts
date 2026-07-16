import type { AuthUser } from '../../common/auth-user';
import { CreateProjectDto, UpdateProjectDto, UpsertMemberDto } from './projects.dto';
import { ProjectsService } from './projects.service';
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    list(user: AuthUser): Promise<{
        data: {
            myRole: string | undefined;
            id: string;
            name: string;
            slug: string;
            settings: Record<string, unknown>;
            createdBy: string | null;
            deletedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        meta: {
            nextCursor: null;
        };
    }>;
    create(dto: CreateProjectDto, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").ProjectRow>;
    get(projectId: string): Promise<import("@seo-guardian/db").ProjectRow>;
    update(projectId: string, dto: UpdateProjectDto, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").ProjectRow>;
    remove(projectId: string, actor: AuthUser, ip: string): Promise<void>;
    members(projectId: string): Promise<{
        data: import("@seo-guardian/db").MemberRow[];
        meta: {
            nextCursor: null;
        };
    }>;
    upsertMember(projectId: string, userId: string, dto: UpsertMemberDto, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").MemberRow>;
    removeMember(projectId: string, userId: string, actor: AuthUser, ip: string): Promise<void>;
}
