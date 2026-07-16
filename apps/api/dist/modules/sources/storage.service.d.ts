import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
/** Object storage for uploaded CSVs (MinIO locally, S3 in production). */
export declare class StorageService {
    private readonly logger;
    private readonly client;
    private readonly bucket;
    constructor(config: ConfigService<Env, true>);
    putObject(key: string, body: Buffer, contentType: string): Promise<void>;
    /** Best effort: a dangling object is preferable to failing the user's delete. */
    deleteObjectSafe(key: string): Promise<void>;
}
