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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const db_1 = require("@seo-guardian/db");
const shared_1 = require("@seo-guardian/shared");
const decorators_1 = require("../../common/decorators");
const pagination_1 = require("../../common/pagination");
const schema_dto_1 = require("./schema.dto");
/** Schema.org read APIs: entities, coverage, rich results, history and changes. */
let SchemaController = class SchemaController {
    schema;
    changes;
    aggregates;
    crawls;
    constructor(schema, changes, aggregates, crawls) {
        this.schema = schema;
        this.changes = changes;
        this.aggregates = aggregates;
        this.crawls = crawls;
    }
    async entities(crawlId, query) {
        const limit = query.limit ?? 50;
        const cursor = query.cursor ? (0, pagination_1.decodeTimeCursor)(query.cursor) : undefined;
        const rows = await this.schema.listByCrawl(crawlId, {
            limit: limit + 1,
            cursor,
            schemaType: query.schemaType,
            status: query.status,
            format: query.format,
        });
        const page = rows.slice(0, limit);
        const last = page[page.length - 1];
        return {
            data: page,
            meta: {
                nextCursor: rows.length > limit && last
                    ? (0, pagination_1.encodeTimeCursor)({ createdAt: last.createdAt, id: last.id })
                    : null,
            },
        };
    }
    async coverage(crawlId) {
        const [coverage, typeFrequency, statusCounts, aggregate] = await Promise.all([
            this.schema.coverage(crawlId),
            this.schema.typeFrequency(crawlId),
            this.schema.statusCounts(crawlId),
            this.aggregates.findByCrawl(crawlId),
        ]);
        const metrics = (aggregate?.metrics ?? {});
        return { coverage, typeFrequency, statusCounts, aggregate: metrics.schema ?? null };
    }
    richResults(crawlId) {
        return this.schema.richResultSummary(crawlId);
    }
    async pageSchema(crawlId, pageId) {
        const entities = await this.schema.listByPage(crawlId, pageId);
        return { data: entities };
    }
    async changesList(crawlId, query) {
        const limit = query.limit ?? 50;
        const cursor = query.cursor ? (0, pagination_1.decodeTimeCursor)(query.cursor) : undefined;
        const rows = await this.changes.listByCrawl(crawlId, {
            limit: limit + 1,
            cursor,
            changeType: query.changeType,
        });
        const page = rows.slice(0, limit);
        const last = page[page.length - 1];
        return {
            data: page,
            meta: {
                nextCursor: rows.length > limit && last
                    ? (0, pagination_1.encodeTimeCursor)({ createdAt: last.createdAt, id: last.id })
                    : null,
            },
        };
    }
    changesSummary(crawlId) {
        return this.changes.summary(crawlId);
    }
    async history(websiteId) {
        const crawls = await this.crawls.listByWebsite(websiteId, 30);
        const completed = crawls.filter((c) => c.status === 'completed');
        const history = await Promise.all(completed.map(async (c) => {
            const aggregate = await this.aggregates.findByCrawl(c.id);
            const metrics = (aggregate?.metrics ?? {});
            return { crawlId: c.id, date: c.createdAt, schema: metrics.schema ?? null };
        }));
        return { data: history };
    }
};
exports.SchemaController = SchemaController;
__decorate([
    (0, common_1.Get)('crawls/:crawlId/schema'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Schema entities detected in a crawl (filterable)' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, schema_dto_1.SchemaEntityQueryDto]),
    __metadata("design:returntype", Promise)
], SchemaController.prototype, "entities", null);
__decorate([
    (0, common_1.Get)('crawls/:crawlId/schema/coverage'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Schema coverage metrics for a crawl' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SchemaController.prototype, "coverage", null);
__decorate([
    (0, common_1.Get)('crawls/:crawlId/schema/rich-results'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Rich-result eligibility rollup by profile' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SchemaController.prototype, "richResults", null);
__decorate([
    (0, common_1.Get)('crawls/:crawlId/pages/:pageId/schema'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Schema entities and validation for one page' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('pageId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SchemaController.prototype, "pageSchema", null);
__decorate([
    (0, common_1.Get)('crawls/:crawlId/changes'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Changes detected vs the previous crawl (incl. schema)' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, schema_dto_1.SchemaChangeQueryDto]),
    __metadata("design:returntype", Promise)
], SchemaController.prototype, "changesList", null);
__decorate([
    (0, common_1.Get)('crawls/:crawlId/changes/summary'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Change counts by type for a crawl' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SchemaController.prototype, "changesSummary", null);
__decorate([
    (0, common_1.Get)('websites/:websiteId/schema/history'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'website', 'websiteId'),
    (0, swagger_1.ApiOperation)({ summary: 'Schema coverage across recent crawls of a website' }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SchemaController.prototype, "history", null);
exports.SchemaController = SchemaController = __decorate([
    (0, swagger_1.ApiTags)('schema'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [db_1.SchemaEntitiesRepository,
        db_1.CrawlChangesRepository,
        db_1.CrawlAggregatesRepository,
        db_1.CrawlsRepository])
], SchemaController);
//# sourceMappingURL=schema.controller.js.map