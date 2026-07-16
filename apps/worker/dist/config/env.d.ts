import { z } from 'zod';
export declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodDefault<z.ZodString>;
    /** Comma-separated queues this process consumes; '*' = all. Enables the fetch/render pool split. */
    WORKER_QUEUES: z.ZodDefault<z.ZodString>;
    /** Object storage (raw/normalized HTML). */
    S3_ENDPOINT: z.ZodOptional<z.ZodString>;
    S3_REGION: z.ZodDefault<z.ZodString>;
    S3_ACCESS_KEY: z.ZodDefault<z.ZodString>;
    S3_SECRET_KEY: z.ZodDefault<z.ZodString>;
    S3_BUCKET_HTML: z.ZodDefault<z.ZodString>;
    S3_FORCE_PATH_STYLE: z.ZodEffects<z.ZodDefault<z.ZodString>, boolean, string | undefined>;
    /** Crawl defaults (per-website settings override these). */
    CRAWLER_USER_AGENT: z.ZodDefault<z.ZodString>;
    FETCH_CONCURRENCY: z.ZodDefault<z.ZodNumber>;
    RENDER_CONCURRENCY: z.ZodDefault<z.ZodNumber>;
    LINK_CHECK_CONCURRENCY: z.ZodDefault<z.ZodNumber>;
    DEFAULT_DOMAIN_RATE_PER_SEC: z.ZodDefault<z.ZodNumber>;
    DEFAULT_DOMAIN_CONCURRENCY: z.ZodDefault<z.ZodNumber>;
    /** Test hook: allow the SSRF guard to reach these host:port fixture servers. */
    CRAWLER_ALLOW_PRIVATE_TARGETS: z.ZodDefault<z.ZodString>;
    /**
     * Optional forward proxy for all crawl egress. When set, the Playwright render
     * pool routes through it (see docs/09 §Egress proxy) so browser navigation —
     * which the in-process SSRF guard cannot intercept — is subject to the proxy's
     * central allow/deny policy. Leave empty to disable.
     */
    EGRESS_PROXY_URL: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    DATABASE_URL: string;
    REDIS_URL: string;
    WORKER_QUEUES: string;
    S3_REGION: string;
    S3_ACCESS_KEY: string;
    S3_SECRET_KEY: string;
    S3_BUCKET_HTML: string;
    S3_FORCE_PATH_STYLE: boolean;
    CRAWLER_USER_AGENT: string;
    FETCH_CONCURRENCY: number;
    RENDER_CONCURRENCY: number;
    LINK_CHECK_CONCURRENCY: number;
    DEFAULT_DOMAIN_RATE_PER_SEC: number;
    DEFAULT_DOMAIN_CONCURRENCY: number;
    CRAWLER_ALLOW_PRIVATE_TARGETS: string;
    S3_ENDPOINT?: string | undefined;
    EGRESS_PROXY_URL?: string | undefined;
}, {
    DATABASE_URL: string;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    REDIS_URL?: string | undefined;
    WORKER_QUEUES?: string | undefined;
    S3_ENDPOINT?: string | undefined;
    S3_REGION?: string | undefined;
    S3_ACCESS_KEY?: string | undefined;
    S3_SECRET_KEY?: string | undefined;
    S3_BUCKET_HTML?: string | undefined;
    S3_FORCE_PATH_STYLE?: string | undefined;
    CRAWLER_USER_AGENT?: string | undefined;
    FETCH_CONCURRENCY?: number | undefined;
    RENDER_CONCURRENCY?: number | undefined;
    LINK_CHECK_CONCURRENCY?: number | undefined;
    DEFAULT_DOMAIN_RATE_PER_SEC?: number | undefined;
    DEFAULT_DOMAIN_CONCURRENCY?: number | undefined;
    CRAWLER_ALLOW_PRIVATE_TARGETS?: string | undefined;
    EGRESS_PROXY_URL?: string | undefined;
}>;
export type Env = z.infer<typeof envSchema>;
export declare function validateEnv(config: Record<string, unknown>): Env;
/** Which queues this worker instance should register processors for. */
export declare function enabledQueues(env: Env): Set<string> | 'all';
