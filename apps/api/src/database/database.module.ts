import { Global, Module } from '@nestjs/common';
import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SYSTEM_USER_ID } from '../common/auth-user';
import {
  AuditLogsRepository,
  CrawlAggregatesRepository,
  CrawlChangesRepository,
  CrawlsRepository,
  Database,
  LinkChecksRepository,
  PageIssuesRepository,
  PageSnapshotsRepository,
  PagesRepository,
  ProjectMembersRepository,
  ProjectsRepository,
  RefreshTokensRepository,
  SchedulesRepository,
  SchemaEntitiesRepository,
  SitemapGroupsRepository,
  UrlSourcesRepository,
  UsersRepository,
  WebsitesRepository,
} from '@seo-guardian/db';
import type { Env } from '../config/env';

const repositories = [
  { provide: UsersRepository, useFactory: (db: Database) => new UsersRepository(db) },
  {
    provide: RefreshTokensRepository,
    useFactory: (db: Database) => new RefreshTokensRepository(db),
  },
  { provide: ProjectsRepository, useFactory: (db: Database) => new ProjectsRepository(db) },
  {
    provide: ProjectMembersRepository,
    useFactory: (db: Database) => new ProjectMembersRepository(db),
  },
  { provide: WebsitesRepository, useFactory: (db: Database) => new WebsitesRepository(db) },
  { provide: UrlSourcesRepository, useFactory: (db: Database) => new UrlSourcesRepository(db) },
  {
    provide: SitemapGroupsRepository,
    useFactory: (db: Database) => new SitemapGroupsRepository(db),
  },
  { provide: SchedulesRepository, useFactory: (db: Database) => new SchedulesRepository(db) },
  { provide: AuditLogsRepository, useFactory: (db: Database) => new AuditLogsRepository(db) },
  { provide: CrawlsRepository, useFactory: (db: Database) => new CrawlsRepository(db) },
  { provide: PagesRepository, useFactory: (db: Database) => new PagesRepository(db) },
  {
    provide: PageSnapshotsRepository,
    useFactory: (db: Database) => new PageSnapshotsRepository(db),
  },
  { provide: PageIssuesRepository, useFactory: (db: Database) => new PageIssuesRepository(db) },
  { provide: LinkChecksRepository, useFactory: (db: Database) => new LinkChecksRepository(db) },
  {
    provide: CrawlAggregatesRepository,
    useFactory: (db: Database) => new CrawlAggregatesRepository(db),
  },
  {
    provide: SchemaEntitiesRepository,
    useFactory: (db: Database) => new SchemaEntitiesRepository(db),
  },
  { provide: CrawlChangesRepository, useFactory: (db: Database) => new CrawlChangesRepository(db) },
].map((r) => ({ ...r, inject: [Database] }));

@Global()
@Module({
  providers: [
    {
      provide: Database,
      useFactory: (config: ConfigService<Env, true>) =>
        new Database({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          applicationName: 'seo-guardian-api',
        }),
      inject: [ConfigService],
    },
    ...repositories,
  ],
  exports: [Database, ...repositories.map((r) => r.provide)],
})
export class DatabaseModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(private readonly db: Database) {}

  /**
   * Ensures the fixed system user exists. With authentication removed, every
   * request acts as this user, so created_by / audit foreign keys stay valid.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.db.query(
      `INSERT INTO users (id, email, password_hash, name, is_super_admin, is_active)
       VALUES ($1, 'system@local', 'disabled', 'System', true, true)
       ON CONFLICT (id) DO NOTHING`,
      [SYSTEM_USER_ID],
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.db.close();
  }
}
