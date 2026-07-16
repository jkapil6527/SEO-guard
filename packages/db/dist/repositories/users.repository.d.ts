import type { Database } from '../database';
export interface UserRow {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    isSuperAdmin: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UsersRepository {
    private readonly db;
    constructor(db: Database);
    findById(id: string): Promise<UserRow | null>;
    findByEmail(email: string): Promise<UserRow | null>;
    list(limit: number, cursor?: {
        createdAt: Date;
        id: string;
    }): Promise<UserRow[]>;
    create(input: {
        email: string;
        passwordHash: string;
        name: string;
        isSuperAdmin?: boolean;
    }): Promise<UserRow>;
    update(id: string, patch: Partial<Pick<UserRow, 'name' | 'isActive' | 'isSuperAdmin' | 'passwordHash'>>): Promise<UserRow | null>;
    countAll(): Promise<number>;
}
