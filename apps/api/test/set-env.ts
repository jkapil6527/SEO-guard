/**
 * Runs before any module import in the integration suite. AppModule evaluates
 * ConfigModule.forRoot (and its env validation) at import time, so the
 * environment must be complete here.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.INT_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.JWT_ACCESS_SECRET = 'integration-test-secret-integration-test-secret';
process.env.JWT_ACCESS_TTL_SECONDS = '900';
process.env.REFRESH_TOKEN_TTL_DAYS = '30';
process.env.REDIS_URL =
  process.env.INT_TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
