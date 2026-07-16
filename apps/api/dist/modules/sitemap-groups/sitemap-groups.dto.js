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
exports.StartGroupCrawlDto = exports.PreviewSitemapDto = exports.UpdateSitemapGroupDto = exports.CreateSitemapGroupDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const class_validator_1 = require("class-validator");
class CreateSitemapGroupDto {
    websiteId;
    name;
    sitemapUrl;
}
exports.CreateSitemapGroupDto = CreateSitemapGroupDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Website this category belongs to' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSitemapGroupDto.prototype, "websiteId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Model Pages' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 60),
    __metadata("design:type", String)
], CreateSitemapGroupDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'https://www.bikedekho.com/sitemap-models.xml' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSitemapGroupDto.prototype, "sitemapUrl", void 0);
class UpdateSitemapGroupDto {
    name;
    sitemapUrl;
    isActive;
}
exports.UpdateSitemapGroupDto = UpdateSitemapGroupDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 60),
    __metadata("design:type", String)
], UpdateSitemapGroupDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSitemapGroupDto.prototype, "sitemapUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateSitemapGroupDto.prototype, "isActive", void 0);
class PreviewSitemapDto {
    sitemapUrl;
}
exports.PreviewSitemapDto = PreviewSitemapDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Sitemap to parse. Defaults to the category’s own sitemap.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PreviewSitemapDto.prototype, "sitemapUrl", void 0);
class StartGroupCrawlDto {
    mode;
}
exports.StartGroupCrawlDto = StartGroupCrawlDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.CrawlMode, default: shared_1.CrawlMode.Incremental }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.CrawlMode),
    __metadata("design:type", String)
], StartGroupCrawlDto.prototype, "mode", void 0);
//# sourceMappingURL=sitemap-groups.dto.js.map