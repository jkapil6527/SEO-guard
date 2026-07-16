import type { Database } from '../database';
export interface ProjectRow {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
    createdBy: string | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class ProjectsRepository {
    private readonly db;
    constructor(db: Database);
    findById(id: string): Promise<ProjectRow | null>;
    findBySlug(slug: string): Promise<ProjectRow | null>;
    /** Projects visible to a user: all for super admins, memberships otherwise. */
    listForUser(userId: string, isSuperAdmin: boolean): Promise<ProjectRow[]>;
    /** Creates the project and grants the creator the admin membership atomically. */
    createWithOwner(input: {
        name: string;
        slug: string;
        settings?: Record<string, unknown>;
        createdBy: string;
    }): Promise<ProjectRow>;
    update(id: string, patch: {
        name?: string;
        settings?: Record<string, unknown>;
    }): Promise<ProjectRow | null>;
    softDelete(id: string): Promise<ProjectRow | null>;
}
