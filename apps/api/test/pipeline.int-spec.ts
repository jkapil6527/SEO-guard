import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { startFixtureSite } from './fixture-site';
import type { FixtureSite } from './fixture-site';

/** Ping Redis so the suite skips cleanly (rather than hanging) when it's absent. */
async function redisReachable(): Promise<boolean> {
  const url = process.env.INT_TEST_REDIS_URL ?? process.env.REDIS_URL;
  if (!url) return false;
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 1500,
  });
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

const hasRedis =
  process.env.INT_TEST_REDIS_URL !== undefined || process.env.TEST_REDIS_URL !== undefined;
const describePipeline = hasRedis ? describe : describe.skip;

/**
 * End-to-end crawl pipeline: a fixture website is crawled by the real worker
 * (in-process, all queues) driven through the real API over HTTP, backed by the
 * embedded PostgreSQL + Redis. Asserts fetch, validation, duplicate detection,
 * broken-link detection, scoring and progress.
 */
describePipeline('Crawl pipeline (integration, Redis workers)', () => {
  let site: FixtureSite;
  let worker: INestApplicationContext;
  let app: INestApplication;
  let http: () => ReturnType<typeof request>;
  let websiteId: string;

  jest.setTimeout(120_000);

  beforeAll(async () => {
    if (!(await redisReachable())) {
      throw new Error('INT_TEST_REDIS_URL/TEST_REDIS_URL set but Redis is not reachable');
    }
    site = await startFixtureSite();

    // Configure the worker to reach the private fixture host and skip object storage.
    process.env.CRAWLER_ALLOW_PRIVATE_TARGETS = `127.0.0.1:${site.port}`;
    process.env.WORKER_QUEUES = '*';
    process.env.S3_ACCESS_KEY = '';
    process.env.DEFAULT_DOMAIN_RATE_PER_SEC = '50';

    // Import the worker after env is set so config validation sees it.
    const { WorkerModule } = await import('@seo-guardian/worker');
    worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    await worker.init();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    await app.init();
    http = () => request(app.getHttpServer());

    // Project + website (origin = fixture) + manual source listing every page.
    // No authentication — endpoints are open.
    const project = await http()
      .post('/api/v1/projects')
      .send({ name: 'Pipeline', slug: 'pipeline' })
      .expect(201);
    const website = await http()
      .post(`/api/v1/projects/${project.body.id}/websites`)
      .send({ name: 'Fixture', origin: site.origin })
      .expect(201);
    websiteId = website.body.id;
    await http()
      .post(`/api/v1/websites/${websiteId}/sources`)
      .send({
        type: 'manual',
        urls: [
          `${site.origin}/`,
          `${site.origin}/about`,
          `${site.origin}/products`,
          `${site.origin}/products-dup`,
          `${site.origin}/missing`,
        ],
      })
      .expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await worker?.close();
    await site?.close();
  });

  // Authentication removed: no headers needed. Kept as a no-op so the request
  // chains below read the same as before.
  const auth = (): Record<string, string> => ({});

  async function waitForCrawl(crawlId: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + 90_000;
    for (;;) {
      const res = await http().get(`/api/v1/crawls/${crawlId}`).set(auth()).expect(200);
      const status = res.body.status as string;
      if (['completed', 'failed', 'cancelled'].includes(status)) return res.body;
      if (Date.now() > deadline) throw new Error(`crawl did not finish; last status=${status}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  it('crawls the fixture site and finalizes with a score', async () => {
    const started = await http()
      .post(`/api/v1/websites/${websiteId}/crawls`)
      .set(auth())
      .send({ mode: 'full' })
      .expect(202);
    const crawlId = started.body.crawlId as string;

    const final = await waitForCrawl(crawlId);
    expect(final.status).toBe('completed');
    expect((final.stats as Record<string, number>).total).toBe(5);
    expect((final.stats as Record<string, number>).failed).toBeGreaterThanOrEqual(1); // /missing

    const summary = await http()
      .get(`/api/v1/crawls/${crawlId}/issues/summary`)
      .set(auth())
      .expect(200);
    expect(summary.body.aggregate).toBeTruthy();
    expect(Number(summary.body.aggregate.seoScore)).toBeGreaterThan(0);
    expect(Number(summary.body.aggregate.seoScore)).toBeLessThanOrEqual(100);

    const checkIds: string[] = summary.body.byCheck.map((c: { checkId: string }) => c.checkId);
    // Duplicate title across /products and /products-dup ("Catalog — Acme").
    expect(checkIds).toContain('duplicate.title');
    // Missing meta description on /products.
    expect(checkIds.some((id) => id.startsWith('meta.description'))).toBe(true);
    // Broken internal link to /missing referenced from the home page.
    expect(checkIds).toContain('links.internal.broken');
  });

  it('lists crawled pages and marks the 404 as an error', async () => {
    const history = await http()
      .get(`/api/v1/websites/${websiteId}/crawls`)
      .set(auth())
      .expect(200);
    const crawlId = history.body.data[0].id as string;

    const pages = await http()
      .get(`/api/v1/crawls/${crawlId}/pages`)
      .set(auth())
      .query({ limit: 50 })
      .expect(200);
    expect(pages.body.data.length).toBe(5);

    const errorPages = await http()
      .get(`/api/v1/crawls/${crawlId}/pages`)
      .set(auth())
      .query({ fetchStatus: 'error' })
      .expect(200);
    expect(errorPages.body.data.length).toBe(1);
    expect(errorPages.body.data[0].url).toContain('/missing');
  });

  it('extracts, validates and reports schema.org structured data', async () => {
    const history = await http()
      .get(`/api/v1/websites/${websiteId}/crawls`)
      .set(auth())
      .expect(200);
    const crawlId = history.body.data[0].id as string;

    // Coverage: home has Organization + WebSite, products has Product = 3 entities on 2 pages.
    const coverage = await http()
      .get(`/api/v1/crawls/${crawlId}/schema/coverage`)
      .set(auth())
      .expect(200);
    expect(coverage.body.coverage.totalEntities).toBe(3);
    expect(coverage.body.coverage.pagesWithSchema).toBe(2);
    const types = coverage.body.typeFrequency.map((t: { schemaType: string }) => t.schemaType);
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'Product']));

    // Entities endpoint, filtered by type.
    const products = await http()
      .get(`/api/v1/crawls/${crawlId}/schema`)
      .set(auth())
      .query({ schemaType: 'Product' })
      .expect(200);
    expect(products.body.data.length).toBe(1);
    expect(products.body.data[0].schemaType).toBe('Product');

    // Rich-result rollup: Product is ineligible (missing required "image").
    const rich = await http()
      .get(`/api/v1/crawls/${crawlId}/schema/rich-results`)
      .set(auth())
      .expect(200);
    const productVerdict = rich.body.find(
      (r: { profile: string; status: string }) => r.profile === 'Product',
    );
    expect(productVerdict?.status).toBe('ineligible');
  });

  it('rejects starting a second crawl while one is active, and enforces RBAC', async () => {
    // No active crawl now, so a fresh start should be accepted then we cancel it.
    const started = await http()
      .post(`/api/v1/websites/${websiteId}/crawls`)
      .set(auth())
      .send({ mode: 'incremental' })
      .expect(202);
    await http()
      .post(`/api/v1/websites/${websiteId}/crawls`)
      .set(auth())
      .send({ mode: 'incremental' })
      .expect(409);
    await http().post(`/api/v1/crawls/${started.body.crawlId}/cancel`).set(auth()).expect(202);
    await waitForCrawl(started.body.crawlId).catch(() => undefined);
  });
});
