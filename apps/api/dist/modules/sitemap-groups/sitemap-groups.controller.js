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
exports.SitemapGroupsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const decorators_1 = require("../../common/decorators");
const sitemap_groups_dto_1 = require("./sitemap-groups.dto");
const sitemap_groups_service_1 = require("./sitemap-groups.service");
let SitemapGroupsController = class SitemapGroupsController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(projectId) {
        return this.service.listByProject(projectId).then((data) => ({ data }));
    }
    create(_projectId, dto, actor) {
        return this.service.create({
            websiteId: dto.websiteId,
            name: dto.name,
            sitemapUrl: dto.sitemapUrl,
            actor,
        });
    }
    get(groupId) {
        return this.service.get(groupId);
    }
    trend(groupId) {
        return this.service.trend(groupId).then((data) => ({ data }));
    }
    update(groupId, dto) {
        return this.service.update(groupId, dto);
    }
    async remove(groupId) {
        await this.service.remove(groupId);
    }
    preview(groupId, dto) {
        return this.service.preview(groupId, dto.sitemapUrl);
    }
    startCrawl(groupId, dto, actor, ip) {
        return this.service.startCrawl(groupId, dto.mode ?? shared_1.CrawlMode.Incremental, { actor, ip });
    }
};
exports.SitemapGroupsController = SitemapGroupsController;
__decorate([
    (0, common_1.Get)('projects/:projectId/sitemap-groups'),
    (0, swagger_1.ApiOperation)({ summary: 'Categories of a project, with dashboard-card rollups' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SitemapGroupsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('projects/:projectId/sitemap-groups'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a category' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, sitemap_groups_dto_1.CreateSitemapGroupDto, Object]),
    __metadata("design:returntype", Promise)
], SitemapGroupsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('sitemap-groups/:groupId'),
    (0, swagger_1.ApiOperation)({ summary: 'Category detail' }),
    __param(0, (0, common_1.Param)('groupId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SitemapGroupsController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('sitemap-groups/:groupId/trend'),
    (0, swagger_1.ApiOperation)({ summary: '30-day score history for this category' }),
    __param(0, (0, common_1.Param)('groupId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SitemapGroupsController.prototype, "trend", null);
__decorate([
    (0, common_1.Patch)('sitemap-groups/:groupId'),
    (0, swagger_1.ApiOperation)({ summary: 'Rename a category or change its sitemap' }),
    __param(0, (0, common_1.Param)('groupId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, sitemap_groups_dto_1.UpdateSitemapGroupDto]),
    __metadata("design:returntype", Promise)
], SitemapGroupsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('sitemap-groups/:groupId'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a category' }),
    __param(0, (0, common_1.Param)('groupId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SitemapGroupsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('sitemap-groups/:groupId/preview'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({ summary: 'Parse the sitemap and report its contents — does not crawl' }),
    __param(0, (0, common_1.Param)('groupId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, sitemap_groups_dto_1.PreviewSitemapDto]),
    __metadata("design:returntype", void 0)
], SitemapGroupsController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('sitemap-groups/:groupId/crawls'),
    (0, common_1.HttpCode)(202),
    (0, swagger_1.ApiOperation)({ summary: 'Crawl exactly this category' }),
    __param(0, (0, common_1.Param)('groupId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, sitemap_groups_dto_1.StartGroupCrawlDto, Object, String]),
    __metadata("design:returntype", void 0)
], SitemapGroupsController.prototype, "startCrawl", null);
exports.SitemapGroupsController = SitemapGroupsController = __decorate([
    (0, swagger_1.ApiTags)('sitemap-groups'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [sitemap_groups_service_1.SitemapGroupsService])
], SitemapGroupsController);
//# sourceMappingURL=sitemap-groups.controller.js.map