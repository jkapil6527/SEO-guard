import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
/**
 * Stores raw and normalized HTML bodies in object storage, keyed by content
 * hash so identical bodies dedupe. PostgreSQL keeps only the hash pointer
 * (docs/02 §3 D3).
 */
export declare class HtmlStorageService {
    private readonly logger;
    private readonly client;
    private readonly bucket;
    constructor(config: ConfigService<Env, true>);
    get enabled(): boolean;
    key(kind: 'raw' | 'normalized', contentHashHex: string): string;
    put(kind: 'raw' | 'normalized', contentHashHex: string, body: Buffer): Promise<string | null>;
    get(key: string): Promise<Buffer | null>;
}
