import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env';
import { envFilePaths } from './config/env-files';
import { DatabaseModule } from './database/database.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { createValidationPipe } from './common/validation';
import { QueueRootModule } from './queue/queue-root.module';
import { AuditModule } from './modules/audit/audit.module';
import { CrawlsModule } from './modules/crawls/crawls.module';
import { SitemapGroupsModule } from './modules/sitemap-groups/sitemap-groups.module';
import { SchemaModule } from './modules/schema/schema.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { SourcesModule } from './modules/sources/sources.module';
import { WebsitesModule } from './modules/websites/websites.module';

/**
 * Authentication has been removed from this build: there is no login, no JWT and
 * no per-project RBAC — every endpoint is open. A single seeded "system" user is
 * used as the actor for created_by / audit fields so referential integrity and
 * the audit trail still hold. A basic per-IP rate limiter remains.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: envFilePaths() }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
    DatabaseModule,
    QueueRootModule,
    AuditModule,
    JobsModule,
    ProjectsModule,
    WebsitesModule,
    SourcesModule,
    SchedulesModule,
    CrawlsModule,
    SitemapGroupsModule,
    SchemaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
