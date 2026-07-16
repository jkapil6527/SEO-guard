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
exports.CrawlsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const rxjs_1 = require("rxjs");
const decorators_1 = require("../../common/decorators");
const pagination_1 = require("../../common/pagination");
const pagination_2 = require("../../common/pagination");
const crawl_progress_service_1 = require("./crawl-progress.service");
const crawls_dto_1 = require("./crawls.dto");
const crawls_service_1 = require("./crawls.service");
let CrawlsController = class CrawlsController {
    crawlsService;
    progress;
    constructor(crawlsService, progress) {
        this.crawlsService = crawlsService;
        this.progress = progress;
    }
    async start(websiteId, dto, actor, ip) {
        const crawl = await this.crawlsService.start(websiteId, dto.mode ?? shared_1.CrawlMode.Incremental, dto.scope ?? shared_1.CrawlScope.Site, dto.url, { actor, ip }, dto.sitemapGroupId);
        return { crawlId: crawl.id, status: crawl.status };
    }
    async reports(query) {
        const limit = query.limit ?? 50;
        const cursor = query.cursor ? (0, pagination_1.decodeTimeCursor)(query.cursor) : undefined;
        const rows = await this.crawlsService.listAll(limit + 1, cursor?.createdAt, query.projectId);
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
    async history(websiteId, query) {
        const limit = query.limit ?? 50;
        const cursor = query.cursor ? (0, pagination_1.decodeTimeCursor)(query.cursor) : undefined;
        const rows = await this.crawlsService.history(websiteId, limit + 1, cursor?.createdAt);
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
    status(crawlId) {
        return this.crawlsService.getStatus(crawlId);
    }
    progressStream(crawlId) {
        return this.progress.stream(crawlId).pipe((0, rxjs_1.map)((event) => ({ data: event })));
    }
    async pause(crawlId, actor, ip) {
        await this.crawlsService.pause(crawlId, { actor, ip });
        return { status: 'paused' };
    }
    async resume(crawlId, actor, ip) {
        await this.crawlsService.resume(crawlId, { actor, ip });
        return { status: 'running' };
    }
    async cancel(crawlId, actor, ip) {
        await this.crawlsService.cancel(crawlId, { actor, ip });
        return { status: 'cancelling' };
    }
    retryFailed(crawlId, actor, ip) {
        return this.crawlsService.retryFailed(crawlId, { actor, ip });
    }
};
exports.CrawlsController = CrawlsController;
__decorate([
    (0, common_1.Post)('websites/:websiteId/crawls'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'website', 'websiteId'),
    (0, common_1.HttpCode)(202),
    (0, swagger_1.ApiOperation)({ summary: 'Start a crawl (seo manager)' }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, crawls_dto_1.StartCrawlDto, Object, String]),
    __metadata("design:returntype", Promise)
], CrawlsController.prototype, "start", null);
__decorate([
    (0, common_1.Get)('crawls'),
    (0, swagger_1.ApiOperation)({ summary: 'Crawl reports across every website' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [crawls_dto_1.CrawlReportQueryDto]),
    __metadata("design:returntype", Promise)
], CrawlsController.prototype, "reports", null);
__decorate([
    (0, common_1.Get)('websites/:websiteId/crawls'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'website', 'websiteId'),
    (0, swagger_1.ApiOperation)({ summary: 'Crawl history for a website' }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_2.CursorQueryDto]),
    __metadata("design:returntype", Promise)
], CrawlsController.prototype, "history", null);
__decorate([
    (0, common_1.Get)('crawls/:crawlId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Crawl status with live counters' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CrawlsController.prototype, "status", null);
__decorate([
    (0, common_1.Sse)('crawls/:crawlId/progress'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'crawl', 'crawlId'),
    (0, swagger_1.ApiOperation)({ summary: 'Live crawl progress (SSE stream)' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Function)
], CrawlsController.prototype, "progressStream", null);
__decorate([
    (0, common_1.Post)('crawls/:crawlId/pause'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'crawl', 'crawlId'),
    (0, common_1.HttpCode)(202),
    (0, swagger_1.ApiOperation)({ summary: 'Pause a running crawl (seo manager)' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], CrawlsController.prototype, "pause", null);
__decorate([
    (0, common_1.Post)('crawls/:crawlId/resume'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'crawl', 'crawlId'),
    (0, common_1.HttpCode)(202),
    (0, swagger_1.ApiOperation)({ summary: 'Resume a paused crawl (seo manager)' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], CrawlsController.prototype, "resume", null);
__decorate([
    (0, common_1.Post)('crawls/:crawlId/cancel'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'crawl', 'crawlId'),
    (0, common_1.HttpCode)(202),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a crawl (seo manager)' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], CrawlsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('crawls/:crawlId/retry-failed'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'crawl', 'crawlId'),
    (0, common_1.HttpCode)(202),
    (0, swagger_1.ApiOperation)({ summary: 'Re-enqueue failed pages of a crawl (seo manager)' }),
    __param(0, (0, common_1.Param)('crawlId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], CrawlsController.prototype, "retryFailed", null);
exports.CrawlsController = CrawlsController = __decorate([
    (0, swagger_1.ApiTags)('crawls'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [crawls_service_1.CrawlsService,
        crawl_progress_service_1.CrawlProgressService])
], CrawlsController);
//# sourceMappingURL=crawls.controller.js.map