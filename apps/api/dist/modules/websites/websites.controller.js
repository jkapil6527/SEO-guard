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
exports.WebsitesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const decorators_1 = require("../../common/decorators");
const websites_dto_1 = require("./websites.dto");
const websites_service_1 = require("./websites.service");
let WebsitesController = class WebsitesController {
    websitesService;
    constructor(websitesService) {
        this.websitesService = websitesService;
    }
    async list(projectId) {
        const data = await this.websitesService.list(projectId);
        return { data, meta: { nextCursor: null } };
    }
    create(projectId, dto, actor, ip) {
        return this.websitesService.create(projectId, dto, { actor, ip });
    }
    get(websiteId) {
        return this.websitesService.getById(websiteId);
    }
    update(websiteId, dto, actor, ip) {
        return this.websitesService.update(websiteId, dto, { actor, ip });
    }
    async remove(websiteId, actor, ip) {
        await this.websitesService.delete(websiteId, { actor, ip });
    }
};
exports.WebsitesController = WebsitesController;
__decorate([
    (0, common_1.Get)('projects/:projectId/websites'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'project', 'projectId'),
    (0, swagger_1.ApiOperation)({ summary: 'List websites in a project' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WebsitesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('projects/:projectId/websites'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'project', 'projectId'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a website to a project (seo manager)' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, websites_dto_1.CreateWebsiteDto, Object, String]),
    __metadata("design:returntype", void 0)
], WebsitesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('websites/:websiteId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'website', 'websiteId'),
    (0, swagger_1.ApiOperation)({ summary: 'Website detail' }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WebsitesController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)('websites/:websiteId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'website', 'websiteId'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a website (seo manager)' }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, websites_dto_1.UpdateWebsiteDto, Object, String]),
    __metadata("design:returntype", void 0)
], WebsitesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('websites/:websiteId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Admin, 'website', 'websiteId'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a website and all its data (admin)' }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], WebsitesController.prototype, "remove", null);
exports.WebsitesController = WebsitesController = __decorate([
    (0, swagger_1.ApiTags)('websites'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [websites_service_1.WebsitesService])
], WebsitesController);
//# sourceMappingURL=websites.controller.js.map