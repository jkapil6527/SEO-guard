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
exports.CrawlReadsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const db_1 = require("@seo-guardian/db");
const seo_engine_1 = require("@seo-guardian/seo-engine");
const shared_1 = require("@seo-guardian/shared");
const decorators_1 = require("../../common/decorators");
const pagination_1 = require("../../common/pagination");
const crawls_dto_1 = require("./crawls.dto");
/** Read models over a crawl's snapshots, issues and aggregates. */
let CrawlReadsController = class CrawlReadsController {
    snapshots;
    issues;
    aggregates;
    constructor(snapshots, issues, aggregates) {
        this.snapshots = snapshots;
        this.issues = issues;
        this.aggregates = aggregates;
    }
    async pages(crawlId, query) {
        const limit = query.limit ?? 50;
        const cursor = query.cursor ? (0, pagination_1.decodeTimeCursor)(query.cursor) : undefined;
        const rows = await this.snapshots.listByCrawl(crawlId, {
            limit: limit + 1,
            cursor,
            fetchStatus: query.fetchStatus,
        });
        return this.paginate(rows, limit);
    }
    async page(crawlId, pageId) {
        const snapshot = await this.snapshots.findByCrawlAndPage(crawlId, pageId);
        if (!snapshot) {
            throw new common_1.NotFoundException({
                code: shared_1.ERROR_CODES.NOT_FOUND,
                message: 'page snapshot not found',
            });
        }
        const [rows, duplicates] = await Promise.all([
            this.issues.listByPage(crawlId, pageId),
            this.issues.duplicateSiblings(crawlId, pageId),
        ]);
        // Join each issue to its catalog entry so the report can answer
        // what / where / why / impact / how-to-fix without a second lookup, and
        // attach the colliding URLs to duplicate findings — the "where" of a
        // duplicate is the set of pages it collides with.
        const issues = rows.map((issue) => {
            const meta = (0, seo_engine_1.getCatalogCheck)(issue.checkId);
            const dup = issue.checkId.startsWith('duplicate.')
                ? duplicates.find((d) => d.field === issue.evidence.field)
                : undefined;
            return {
                ...issue,
                check: meta
                    ? {
                        name: meta.name,
                        category: meta.category,
                        description: meta.description,
                        technicalExplanation: meta.technicalExplanation,
                        businessImpact: meta.businessImpact,
                        suggestedFix: meta.suggestedFix,
                        docUrl: meta.docUrl,
                        weight: meta.weight,
                    }
                    : null,
                duplicateOf: dup ? { sample: dup.sample, pageCount: dup.pageCount, urls: dup.urls } : null,
            };
        });
        return { snapshot, issues, duplicates };
    }
    duplicates(crawlId, field) {
        return this.issues.listDuplicateGroups(crawlId, field).then((data) => ({ data }));
    }
    async issuesList(crawlId, query) {
        const limit = query.limit ?? 50;
        const cursor = query.cursor ? (0, pagination_1.decodeTimeCursor)(query.cursor) : undefined;
        const rows = await this.issues.listByCrawl(crawlId, {
            limit: limit + 1,
            cursor,
            severity: query.severity,
            checkId: query.checkId,
        });
        return this.paginate(rows, limit);
    }
    async issuesSummary(crawlId) {
        const [byCheck, bySeverity, aggregate] = await Promise.all([
            this.issues.summaryByCrawl(crawlId),
            this.issues.countsBySeverity(crawlId),
            this.aggregates.findByCrawl(crawlId),
        ]);
        return { byCheck, bySeverity, aggregate };
    }
    paginate(rows, limit) {
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
};
exports.CrawlReadsController = CrawlReadsController;
__decorate([
    (0, common_1.Get)('pages'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Pages crawled in this crawl (filterable)' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, crawls_dto_1.CrawlPageQueryDto]),
    __metadata("design:returntype", Promise)
], CrawlReadsController.prototype, "pages", null);
__decorate([
    (0, common_1.Get)('pages/:pageId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'A single page snapshot with fully-explained issues' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('pageId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CrawlReadsController.prototype, "page", null);
__decorate([
    (0, common_1.Get)('duplicates'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Duplicate title / description / h1 groups across the crawl' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('field')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CrawlReadsController.prototype, "duplicates", null);
__decorate([
    (0, common_1.Get)('issues'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Issues in this crawl (filter by severity/checkId)' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, crawls_dto_1.CrawlIssueQueryDto]),
    __metadata("design:returntype", Promise)
], CrawlReadsController.prototype, "issuesList", null);
__decorate([
    (0, common_1.Get)('issues/summary'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Issue counts by check and severity' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CrawlReadsController.prototype, "issuesSummary", null);
exports.CrawlReadsController = CrawlReadsController = __decorate([
    (0, swagger_1.ApiTags)('crawls'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('crawls/:crawlId'),
    __metadata("design:paramtypes", [db_1.PageSnapshotsRepository,
        db_1.PageIssuesRepository,
        db_1.CrawlAggregatesRepository])
], CrawlReadsController);
//# sourceMappingURL=crawl-reads.controller.js.map