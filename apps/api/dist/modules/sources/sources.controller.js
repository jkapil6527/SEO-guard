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
exports.SourcesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const class_validator_1 = require("class-validator");
const multer_1 = require("multer");
const decorators_1 = require("../../common/decorators");
const validate_dto_1 = require("../../common/validate-dto");
const sources_dto_1 = require("./sources.dto");
const sources_service_1 = require("./sources.service");
const CSV_MAX_BYTES = 20 * 1024 * 1024;
class SetActiveDto {
    isActive;
}
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SetActiveDto.prototype, "isActive", void 0);
let SourcesController = class SourcesController {
    sourcesService;
    constructor(sourcesService) {
        this.sourcesService = sourcesService;
    }
    async list(websiteId) {
        const data = await this.sourcesService.list(websiteId);
        return { data, meta: { nextCursor: null } };
    }
    async create(websiteId, body, actor, ip) {
        const ctx = { actor, ip };
        switch (body.type) {
            case 'manual':
                return this.sourcesService.createManual(websiteId, await (0, validate_dto_1.validateDto)(sources_dto_1.CreateManualSourceDto, body), ctx);
            case 'sitemap':
                return this.sourcesService.createSitemap(websiteId, await (0, validate_dto_1.validateDto)(sources_dto_1.CreateSitemapSourceDto, body), ctx);
            case 'discovery':
                return this.sourcesService.createDiscovery(websiteId, await (0, validate_dto_1.validateDto)(sources_dto_1.CreateDiscoverySourceDto, body), ctx);
            default:
                throw new common_1.BadRequestException({
                    code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                    message: "type must be one of 'manual', 'sitemap', 'discovery' (CSV uses /sources/csv)",
                });
        }
    }
    async uploadCsv(websiteId, file, urlColumn, actor, ip) {
        if (!file) {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.CSV_INVALID,
                message: "Missing file field 'file'",
            });
        }
        return this.sourcesService.createFromCsv(websiteId, file, urlColumn?.trim() || 'url', {
            actor,
            ip,
        });
    }
    async setActive(sourceId, dto, actor, ip) {
        return this.sourcesService.setActive(sourceId, dto.isActive, { actor, ip });
    }
    async remove(sourceId, actor, ip) {
        await this.sourcesService.delete(sourceId, { actor, ip });
    }
};
exports.SourcesController = SourcesController;
__decorate([
    (0, common_1.Get)('websites/:websiteId/sources'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'website', 'websiteId'),
    (0, swagger_1.ApiOperation)({ summary: 'List URL sources of a website' }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('websites/:websiteId/sources'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'website', 'websiteId'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a manual / sitemap / discovery source (seo manager)' }),
    (0, swagger_1.ApiBody)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(sources_dto_1.CreateManualSourceDto) },
                { $ref: (0, swagger_1.getSchemaPath)(sources_dto_1.CreateSitemapSourceDto) },
                { $ref: (0, swagger_1.getSchemaPath)(sources_dto_1.CreateDiscoverySourceDto) },
            ],
            discriminator: { propertyName: 'type' },
        },
    }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('websites/:websiteId/sources/csv'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'website', 'websiteId'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: (0, multer_1.memoryStorage)(), limits: { fileSize: CSV_MAX_BYTES } })),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a URL CSV as a source (seo manager, ≤20MB)' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
                urlColumn: { type: 'string', default: 'url' },
            },
            required: ['file'],
        },
    }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('urlColumn')),
    __param(3, (0, decorators_1.CurrentUser)()),
    __param(4, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "uploadCsv", null);
__decorate([
    (0, common_1.Patch)('sources/:sourceId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'source', 'sourceId'),
    (0, swagger_1.ApiOperation)({ summary: 'Enable/disable a source (seo manager)' }),
    __param(0, (0, common_1.Param)('sourceId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, SetActiveDto, Object, String]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "setActive", null);
__decorate([
    (0, common_1.Delete)('sources/:sourceId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'source', 'sourceId'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a source (seo manager)' }),
    __param(0, (0, common_1.Param)('sourceId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], SourcesController.prototype, "remove", null);
exports.SourcesController = SourcesController = __decorate([
    (0, swagger_1.ApiTags)('sources'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiExtraModels)(sources_dto_1.CreateManualSourceDto, sources_dto_1.CreateSitemapSourceDto, sources_dto_1.CreateDiscoverySourceDto),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [sources_service_1.SourcesService])
], SourcesController);
//# sourceMappingURL=sources.controller.js.map