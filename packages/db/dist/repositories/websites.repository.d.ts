import type { Database } from '../database';
export interface WebsiteRow {
    id: string;
    projectId: string;
    name: string;
    origin: string;
    pathScope: string;
    settings: Record<string, unknown>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class WebsitesRepository {
    private readonly db;
    constructor(db: Database);
    findById(id: string): Promise<WebsiteRow | null>;
    listByProject(projectId: string): Promise<WebsiteRow[]>;
    create(input: {
        projectId: string;
        name: string;
        origin: string;
        pathScope?: string;
        settings?: Record<string, unknown>;
    }): Promise<WebsiteRow>;
    update(id: string, patch: {
        name?: string;
        settings?: Record<string, unknown>;
        isActive?: boolean;
    }): Promise<WebsiteRow | null>;
    delete(id: string): Promise<boolean>;
    /** Resolves the owning project for RBAC checks on nested resources. */
    projectIdOf(websiteId: string): Promise<string | null>;
}
