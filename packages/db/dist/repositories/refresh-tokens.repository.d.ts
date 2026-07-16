import type { Database } from '../database';
export interface RefreshTokenRow {
    id: string;
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    replacedById: string | null;
    createdAt: Date;
}
export declare class RefreshTokensRepository {
    private readonly db;
    constructor(db: Database);
    findByHash(tokenHash: string): Promise<RefreshTokenRow | null>;
    create(input: {
        userId: string;
        familyId: string;
        tokenHash: string;
        expiresAt: Date;
    }): Promise<RefreshTokenRow>;
    /** Marks a token consumed (rotated) and records its successor. */
    markReplaced(id: string, replacedById: string): Promise<void>;
    /** Reuse detected or logout: kill every live token in the family. */
    revokeFamily(familyId: string): Promise<void>;
    revokeAllForUser(userId: string): Promise<void>;
    deleteExpired(): Promise<number>;
}
