import { Database } from '@seo-guardian/db';
/**
 * Seeds the `checks` catalog table from the single-source seo-engine catalog
 * (per-page + cross-page + runtime checks), so every check_id written to
 * page_issues has catalog metadata. Idempotent upsert; runs on worker boot.
 */
export declare class CheckCatalogService {
    private readonly db;
    private readonly logger;
    constructor(db: Database);
    seed(): Promise<number>;
}
