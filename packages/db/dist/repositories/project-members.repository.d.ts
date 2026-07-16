import type { Database } from '../database';
export interface MemberRow {
    projectId: string;
    userId: string;
    role: string;
    createdAt: Date;
    email?: string;
    name?: string;
}
export declare class ProjectMembersRepository {
    private readonly db;
    constructor(db: Database);
    findRole(projectId: string, userId: string): Promise<{
        role: string;
    } | null>;
    list(projectId: string): Promise<MemberRow[]>;
    listForUser(userId: string): Promise<Array<{
        projectId: string;
        role: string;
    }>>;
    upsert(projectId: string, userId: string, role: string): Promise<MemberRow>;
    remove(projectId: string, userId: string): Promise<boolean>;
    countAdmins(projectId: string): Promise<number>;
}
