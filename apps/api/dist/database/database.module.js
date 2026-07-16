"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_user_1 = require("../common/auth-user");
const db_1 = require("@seo-guardian/db");
const repositories = [
    { provide: db_1.UsersRepository, useFactory: (db) => new db_1.UsersRepository(db) },
    {
        provide: db_1.RefreshTokensRepository,
        useFactory: (db) => new db_1.RefreshTokensRepository(db),
    },
    { provide: db_1.ProjectsRepository, useFactory: (db) => new db_1.ProjectsRepository(db) },
    {
        provide: db_1.ProjectMembersRepository,
        useFactory: (db) => new db_1.ProjectMembersRepository(db),
    },
    { provide: db_1.WebsitesRepository, useFactory: (db) => new db_1.WebsitesRepository(db) },
    { provide: db_1.UrlSourcesRepository, useFactory: (db) => new db_1.UrlSourcesRepository(db) },
    {
        provide: db_1.SitemapGroupsRepository,
        useFactory: (db) => new db_1.SitemapGroupsRepository(db),
    },
    { provide: db_1.SchedulesRepository, useFactory: (db) => new db_1.SchedulesRepository(db) },
    { provide: db_1.AuditLogsRepository, useFactory: (db) => new db_1.AuditLogsRepository(db) },
    { provide: db_1.CrawlsRepository, useFactory: (db) => new db_1.CrawlsRepository(db) },
    { provide: db_1.PagesRepository, useFactory: (db) => new db_1.PagesRepository(db) },
    {
        provide: db_1.PageSnapshotsRepository,
        useFactory: (db) => new db_1.PageSnapshotsRepository(db),
    },
    { provide: db_1.PageIssuesRepository, useFactory: (db) => new db_1.PageIssuesRepository(db) },
    { provide: db_1.LinkChecksRepository, useFactory: (db) => new db_1.LinkChecksRepository(db) },
    {
        provide: db_1.CrawlAggregatesRepository,
        useFactory: (db) => new db_1.CrawlAggregatesRepository(db),
    },
    {
        provide: db_1.SchemaEntitiesRepository,
        useFactory: (db) => new db_1.SchemaEntitiesRepository(db),
    },
    { provide: db_1.CrawlChangesRepository, useFactory: (db) => new db_1.CrawlChangesRepository(db) },
].map((r) => ({ ...r, inject: [db_1.Database] }));
let DatabaseModule = class DatabaseModule {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Ensures the fixed system user exists. With authentication removed, every
     * request acts as this user, so created_by / audit foreign keys stay valid.
     */
    async onApplicationBootstrap() {
        await this.db.query(`INSERT INTO users (id, email, password_hash, name, is_super_admin, is_active)
       VALUES ($1, 'system@local', 'disabled', 'System', true, true)
       ON CONFLICT (id) DO NOTHING`, [auth_user_1.SYSTEM_USER_ID]);
    }
    async onApplicationShutdown() {
        await this.db.close();
    }
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: db_1.Database,
                useFactory: (config) => new db_1.Database({
                    connectionString: config.get('DATABASE_URL', { infer: true }),
                    applicationName: 'seo-guardian-api',
                }),
                inject: [config_1.ConfigService],
            },
            ...repositories,
        ],
        exports: [db_1.Database, ...repositories.map((r) => r.provide)],
    }),
    __metadata("design:paramtypes", [db_1.Database])
], DatabaseModule);
//# sourceMappingURL=database.module.js.map