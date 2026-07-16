"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: zod_1.z.coerce.number().int().positive().default(4000),
    API_CORS_ORIGIN: zod_1.z.string().default('http://localhost:3000'),
    // Authentication is removed; these are retained as optional no-ops so existing
    // .env files keep working, but nothing reads them.
    JWT_ACCESS_SECRET: zod_1.z.string().optional(),
    JWT_ACCESS_TTL_SECONDS: zod_1.z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: zod_1.z.coerce.number().int().positive().default(30),
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().url().default('redis://localhost:6379'),
    S3_ENDPOINT: zod_1.z.string().url().optional(),
    S3_REGION: zod_1.z.string().default('us-east-1'),
    S3_ACCESS_KEY: zod_1.z.string().default(''),
    S3_SECRET_KEY: zod_1.z.string().default(''),
    S3_BUCKET_UPLOADS: zod_1.z.string().default('seo-guardian-uploads'),
    S3_FORCE_PATH_STYLE: zod_1.z
        .string()
        .default('false')
        .transform((v) => v === 'true'),
    SEED_ADMIN_EMAIL: zod_1.z.string().email().optional(),
    SEED_ADMIN_PASSWORD: zod_1.z.string().min(10).optional(),
    // The API fetches sitemaps directly for the category preview (parse, report,
    // do not crawl), so it identifies itself with the same UA as the crawler.
    CRAWLER_USER_AGENT: zod_1.z.string().default('SEOGuardianBot/1.0 (+https://seo-guardian.internal/bot)'),
});
function validateEnv(config) {
    const result = exports.envSchema.safeParse(config);
    if (!result.success) {
        const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw new Error(`Invalid environment configuration — ${details}`);
    }
    return result.data;
}
//# sourceMappingURL=env.js.map