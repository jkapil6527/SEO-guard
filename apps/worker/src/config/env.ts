import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  /** Comma-separated queues this process consumes; '*' = all. Enables the fetch/render pool split. */
  WORKER_QUEUES: z.string().default('*'),

  /** Object storage (raw/normalized HTML). */
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_BUCKET_HTML: z.string().default('seo-guardian-html'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /** Crawl defaults (per-website settings override these). */
  CRAWLER_USER_AGENT: z.string().default('SEOGuardianBot/1.0 (+https://seo-guardian.internal/bot)'),
  FETCH_CONCURRENCY: z.coerce.number().int().positive().default(8),
  RENDER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  LINK_CHECK_CONCURRENCY: z.coerce.number().int().positive().default(6),
  DEFAULT_DOMAIN_RATE_PER_SEC: z.coerce.number().positive().default(5),
  DEFAULT_DOMAIN_CONCURRENCY: z.coerce.number().int().positive().default(4),
  /** Test hook: allow the SSRF guard to reach these host:port fixture servers. */
  CRAWLER_ALLOW_PRIVATE_TARGETS: z.string().default(''),
  /**
   * Optional forward proxy for all crawl egress. When set, the Playwright render
   * pool routes through it (see docs/09 §Egress proxy) so browser navigation —
   * which the in-process SSRF guard cannot intercept — is subject to the proxy's
   * central allow/deny policy. Leave empty to disable.
   */
  EGRESS_PROXY_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration — ${details}`);
  }
  return result.data;
}

/** Which queues this worker instance should register processors for. */
export function enabledQueues(env: Env): Set<string> | 'all' {
  const raw = env.WORKER_QUEUES.trim();
  if (raw === '*' || raw === '') return 'all';
  return new Set(
    raw
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean),
  );
}
