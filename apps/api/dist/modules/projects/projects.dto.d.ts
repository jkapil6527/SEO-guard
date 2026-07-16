import { ProjectRole } from '@seo-guardian/shared';
export declare class CreateProjectDto {
    name: string;
    slug: string;
    settings?: Record<string, unknown>;
}
export declare class UpdateProjectDto {
    name?: string;
    settings?: Record<string, unknown>;
}
export declare class UpsertMemberDto {
    role: ProjectRole;
}
