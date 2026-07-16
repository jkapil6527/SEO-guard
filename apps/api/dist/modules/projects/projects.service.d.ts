import { ProjectMembersRepository, ProjectsRepository, UsersRepository } from '@seo-guardian/db';
import type { ProjectRow } from '@seo-guardian/db';
import { ProjectRole } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import type { CreateProjectDto, UpdateProjectDto } from './projects.dto';
interface ActorContext {
    actor: AuthUser;
    ip: string | null;
}
export declare class ProjectsService {
    private readonly projects;
    private readonly members;
    private readonly users;
    private readonly audit;
    constructor(projects: ProjectsRepository, members: ProjectMembersRepository, users: UsersRepository, audit: AuditService);
    listForUser(user: AuthUser): Promise<{
        myRole: string | undefined;
        id: string;
        name: string;
        slug: string;
        settings: Record<string, unknown>;
        createdBy: string | null;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getById(id: string): Promise<ProjectRow>;
    create(dto: CreateProjectDto, ctx: ActorContext): Promise<ProjectRow>;
    update(id: string, dto: UpdateProjectDto, ctx: ActorContext): Promise<ProjectRow>;
    softDelete(id: string, ctx: ActorContext): Promise<void>;
    listMembers(projectId: string): Promise<import("@seo-guardian/db").MemberRow[]>;
    upsertMember(projectId: string, userId: string, role: ProjectRole, ctx: ActorContext): Promise<import("@seo-guardian/db").MemberRow>;
    removeMember(projectId: string, userId: string, ctx: ActorContext): Promise<void>;
    private assertNotLastAdmin;
}
export {};
