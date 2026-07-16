"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.validateEnv = validateEnv;
exports.enabledQueues = enabledQueues;
const zod_1 = require("zod");
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().url().default('redis://localhost:6379'),
    /** Comma-separated queues this process consumes; '*' = all. Enables the fetch/render pool split. */
    WORKER_QUEUES: zod_1.z.string().default('*'),
    /** Object storage (raw/normalized HTML). */
    S3_ENDPOINT: zod_1.z.string().url().optional(),
    S3_REGION: zod_1.z.string().default('us-east-1'),
    S3_ACCESS_KEY: zod_1.z.string().default(''),
    S3_SECRET_KEY: zod_1.z.string().default(''),
    S3_BUCKET_HTML: zod_1.z.string().default('seo-guardian-html'),
    S3_FORCE_PATH_STYLE: zod_1.z
        .string()
        .default('false')
        .transform((v) => v === 'true'),
    /** Crawl defaults (per-website settings override these). */
    CRAWLER_USER_AGENT: zod_1.z.string().default('SEOGuardianBot/1.0 (+https://seo-guardian.internal/bot)'),
    FETCH_CONCURRENCY: zod_1.z.coerce.number().int().positive().default(8),
    RENDER_CONCURRENCY: zod_1.z.coerce.number().int().positive().default(2),
    LINK_CHECK_CONCURRENCY: zod_1.z.coerce.number().int().positive().default(6),
    DEFAULT_DOMAIN_RATE_PER_SEC: zod_1.z.coerce.number().positive().default(5),
    DEFAULT_DOMAIN_CONCURRENCY: zod_1.z.coerce.number().int().positive().default(4),
    /** Test hook: allow the SSRF guard to reach these host:port fixture servers. */
    CRAWLER_ALLOW_PRIVATE_TARGETS: zod_1.z.string().default(''),
    /**
     * Optional forward proxy for all crawl egress. When set, the Playwright render
     * pool routes through it (see docs/09 §Egress proxy) so browser navigation —
     * which the in-process SSRF guard cannot intercept — is subject to the proxy's
     * central allow/deny policy. Leave empty to disable.
     */
    EGRESS_PROXY_URL: zod_1.z.string().url().optional(),
});
function validateEnv(config) {
    const result = exports.envSchema.safeParse(config);
    if (!result.success) {
        const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw new Error(`Invalid environment configuration — ${details}`);
    }
    return result.data;
}
/** Which queues this worker instance should register processors for. */
function enabledQueues(env) {
    const raw = env.WORKER_QUEUES.trim();
    if (raw === '*' || raw === '')
        return 'all';
    return new Set(raw
        .split(',')
        .map((q) => q.trim())
        .filter(Boolean));
}
//# sourceMappingURL=env.js.map