"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const nestjs_pino_1 = require("nestjs-pino");
const env_1 = require("./config/env");
const env_files_1 = require("./config/env-files");
const database_module_1 = require("./database/database.module");
const problem_details_filter_1 = require("./common/problem-details.filter");
const validation_1 = require("./common/validation");
const queue_root_module_1 = require("./queue/queue-root.module");
const audit_module_1 = require("./modules/audit/audit.module");
const crawls_module_1 = require("./modules/crawls/crawls.module");
const sitemap_groups_module_1 = require("./modules/sitemap-groups/sitemap-groups.module");
const schema_module_1 = require("./modules/schema/schema.module");
const health_module_1 = require("./modules/health/health.module");
const jobs_module_1 = require("./modules/jobs/jobs.module");
const projects_module_1 = require("./modules/projects/projects.module");
const schedules_module_1 = require("./modules/schedules/schedules.module");
const sources_module_1 = require("./modules/sources/sources.module");
const websites_module_1 = require("./modules/websites/websites.module");
/**
 * Authentication has been removed from this build: there is no login, no JWT and
 * no per-project RBAC — every endpoint is open. A single seeded "system" user is
 * used as the actor for created_by / audit fields so referential integrity and
 * the audit trail still hold. A basic per-IP rate limiter remains.
 */
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, validate: env_1.validateEnv, envFilePath: (0, env_files_1.envFilePaths)() }),
            nestjs_pino_1.LoggerModule.forRoot({
                pinoHttp: {
                    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
                    transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
                },
            }),
            throttler_1.ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
            database_module_1.DatabaseModule,
            queue_root_module_1.QueueRootModule,
            audit_module_1.AuditModule,
            jobs_module_1.JobsModule,
            projects_module_1.ProjectsModule,
            websites_module_1.WebsitesModule,
            sources_module_1.SourcesModule,
            schedules_module_1.SchedulesModule,
            crawls_module_1.CrawlsModule,
            sitemap_groups_module_1.SitemapGroupsModule,
            schema_module_1.SchemaModule,
            health_module_1.HealthModule,
        ],
        providers: [
            { provide: core_1.APP_PIPE, useFactory: validation_1.createValidationPipe },
            { provide: core_1.APP_FILTER, useClass: problem_details_filter_1.ProblemDetailsFilter },
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map