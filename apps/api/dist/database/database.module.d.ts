import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Database } from '@seo-guardian/db';
export declare class DatabaseModule implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly db;
    constructor(db: Database);
    /**
     * Ensures the fixed system user exists. With authentication removed, every
     * request acts as this user, so created_by / audit foreign keys stay valid.
     */
    onApplicationBootstrap(): Promise<void>;
    onApplicationShutdown(): Promise<void>;
}
