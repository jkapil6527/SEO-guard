import request from 'supertest';
import { createTestApp } from './test-app';
import type { TestApp } from './test-app';

/**
 * Platform integration tests. Authentication has been removed, so every endpoint
 * is called without credentials; these cover the open CRUD surface, validation,
 * CSV upload, the audit trail (recorded against the system user) and health.
 */
describe('Platform (integration, no auth)', () => {
  let t: TestApp;
  let http: () => ReturnType<typeof request>;

  let projectId: string;
  let websiteId: string;
  let scheduleId: string;

  beforeAll(async () => {
    t = await createTestApp();
    http = () => request(t.app.getHttpServer());
  });

  afterAll(async () => {
    await t.close();
  });

  describe('projects', () => {
    it('creates a project without any authentication', async () => {
      const res = await http()
        .post('/api/v1/projects')
        .send({ name: 'CarDekho', slug: 'cardekho' })
        .expect(201);
      projectId = res.body.id;
      expect(res.body.slug).toBe('cardekho');
      // created_by is the seeded system user.
      expect(res.body.createdBy).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('lists projects and rejects duplicate slugs', async () => {
      const list = await http().get('/api/v1/projects').expect(200);
      expect(list.body.data.length).toBeGreaterThanOrEqual(1);
      const dup = await http()
        .post('/api/v1/projects')
        .send({ name: 'Dup', slug: 'cardekho' })
        .expect(409);
      expect(dup.body.code).toBe('CONFLICT');
    });

    it('validates the request body (RFC 7807 problem details)', async () => {
      const res = await http().post('/api/v1/projects').send({ name: 'x' }).expect(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('websites', () => {
    it('creates a website with a normalized origin', async () => {
      const res = await http()
        .post(`/api/v1/projects/${projectId}/websites`)
        .send({ name: 'Main', origin: 'HTTPS://WWW.CarDekho.COM/' })
        .expect(201);
      websiteId = res.body.id;
      expect(res.body.origin).toBe('https://www.cardekho.com');
    });

    it('rejects an origin with a path', async () => {
      const res = await http()
        .post(`/api/v1/projects/${projectId}/websites`)
        .send({ name: 'Bad', origin: 'https://www.cardekho.com/news' })
        .expect(400);
      expect(res.body.detail).toContain('pathScope');
    });
  });

  describe('url sources', () => {
    it('accepts a manual URL list, deduplicated', async () => {
      const res = await http()
        .post(`/api/v1/websites/${websiteId}/sources`)
        .send({
          type: 'manual',
          urls: [
            'https://www.cardekho.com/a',
            'https://www.cardekho.com/a',
            'https://www.cardekho.com/b',
          ],
        })
        .expect(201);
      expect(res.body.config.urls).toHaveLength(2);
    });

    it('uploads a CSV end-to-end', async () => {
      const csv = 'url\nhttps://www.cardekho.com/x\nhttps://www.cardekho.com/y\n';
      const res = await http()
        .post(`/api/v1/websites/${websiteId}/sources/csv`)
        .attach('file', Buffer.from(csv), 'urls.csv')
        .expect(201);
      expect(res.body.config).toMatchObject({ kind: 'csv', rowCount: 2 });
      expect(t.storage.objects.size).toBe(1);
    });

    it('rejects a CSV without the URL column', async () => {
      const res = await http()
        .post(`/api/v1/websites/${websiteId}/sources/csv`)
        .attach('file', Buffer.from('link\nhttps://x.example\n'), 'urls.csv')
        .expect(400);
      expect(res.body.code).toBe('CSV_INVALID');
    });
  });

  describe('schedules', () => {
    it('creates a daily schedule with a computed next run', async () => {
      const res = await http()
        .post(`/api/v1/websites/${websiteId}/schedules`)
        .send({ preset: 'daily', timezone: 'Asia/Kolkata' })
        .expect(201);
      scheduleId = res.body.id;
      expect(res.body.cron).toBe('0 3 * * *');
      expect(new Date(res.body.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects an over-frequent cron and an unknown timezone', async () => {
      await http()
        .post(`/api/v1/websites/${websiteId}/schedules`)
        .send({ cron: '* * * * *', timezone: 'UTC' })
        .expect(400);
      const tz = await http()
        .post(`/api/v1/websites/${websiteId}/schedules`)
        .send({ preset: 'daily', timezone: 'Mars/Olympus' })
        .expect(400);
      expect(tz.body.code).toBe('INVALID_TIMEZONE');
    });

    it('pauses a schedule and clears its next run', async () => {
      const res = await http()
        .patch(`/api/v1/schedules/${scheduleId}`)
        .send({ isActive: false })
        .expect(200);
      expect(res.body.isActive).toBe(false);
      expect(res.body.nextRunAt).toBeNull();
    });
  });

  describe('audit trail', () => {
    it('recorded the mutations above against the system user', async () => {
      const res = await http().get(`/api/v1/projects/${projectId}/audit-logs`).expect(200);
      const actions = res.body.data.map((l: { action: string }) => l.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'project.create',
          'website.create',
          'url_source.create',
          'schedule.create',
        ]),
      );
      expect(res.body.data[0].userId).toBe('00000000-0000-0000-0000-000000000000');
    });
  });

  describe('health', () => {
    it('reports liveness and readiness', async () => {
      await http().get('/api/v1/health').expect(200);
      const res = await http().get('/api/v1/ready').expect(200);
      expect(res.body).toMatchObject({ database: 'ok', redis: 'ok' });
    });
  });
});
