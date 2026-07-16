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
exports.CsvUploadFieldsDto = exports.CreateDiscoverySourceDto = exports.CreateSitemapSourceDto = exports.CreateManualSourceDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
/**
 * Creation payloads are separate DTOs per source type (discriminated by endpoint
 * body `type` handled in the service) to keep validation exact per shape.
 */
class CreateManualSourceDto {
    type;
    urls;
}
exports.CreateManualSourceDto = CreateManualSourceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['manual'] }),
    (0, class_validator_1.Equals)('manual'),
    __metadata("design:type", String)
], CreateManualSourceDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], maxItems: 10000 }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(10000),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(2000, { each: true }),
    __metadata("design:type", Array)
], CreateManualSourceDto.prototype, "urls", void 0);
class CreateSitemapSourceDto {
    type;
    sitemapUrl;
}
exports.CreateSitemapSourceDto = CreateSitemapSourceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['sitemap'] }),
    (0, class_validator_1.Equals)('sitemap'),
    __metadata("design:type", String)
], CreateSitemapSourceDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'https://www.cardekho.com/sitemap.xml' }),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_protocol: true }),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateSitemapSourceDto.prototype, "sitemapUrl", void 0);
class CreateDiscoverySourceDto {
    type;
    seeds;
    maxDepth;
    maxPages;
}
exports.CreateDiscoverySourceDto = CreateDiscoverySourceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['discovery'] }),
    (0, class_validator_1.Equals)('discovery'),
    __metadata("design:type", String)
], CreateDiscoverySourceDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], maxItems: 100 }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(2000, { each: true }),
    __metadata("design:type", Array)
], CreateDiscoverySourceDto.prototype, "seeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 3, minimum: 1, maximum: 10 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], CreateDiscoverySourceDto.prototype, "maxDepth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 10000, minimum: 1, maximum: 1000000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(1_000_000),
    __metadata("design:type", Number)
], CreateDiscoverySourceDto.prototype, "maxPages", void 0);
class CsvUploadFieldsDto {
    urlColumn;
}
exports.CsvUploadFieldsDto = CsvUploadFieldsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'url', description: 'CSV column containing URLs' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CsvUploadFieldsDto.prototype, "urlColumn", void 0);
//# sourceMappingURL=sources.dto.js.map