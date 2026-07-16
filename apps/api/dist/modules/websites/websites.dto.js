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
exports.UpdateWebsiteDto = exports.CreateWebsiteDto = void 0;
exports.normalizeOrigin = normalizeOrigin;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const class_validator_1 = require("class-validator");
class CreateWebsiteDto {
    name;
    origin;
    pathScope;
    settings;
}
exports.CreateWebsiteDto = CreateWebsiteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CarDekho Web' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateWebsiteDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'https://www.cardekho.com' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateWebsiteDto.prototype, "origin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '/', default: '/' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    (0, class_validator_1.Matches)(/^\//, { message: 'pathScope must start with /' }),
    __metadata("design:type", String)
], CreateWebsiteDto.prototype, "pathScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'object', additionalProperties: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateWebsiteDto.prototype, "settings", void 0);
class UpdateWebsiteDto {
    name;
    settings;
    isActive;
}
exports.UpdateWebsiteDto = UpdateWebsiteDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateWebsiteDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'object', additionalProperties: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateWebsiteDto.prototype, "settings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateWebsiteDto.prototype, "isActive", void 0);
/**
 * Normalizes an origin: http(s) only, no credentials/path/query/fragment,
 * lowercased host, default ports stripped.
 */
function normalizeOrigin(raw) {
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new common_1.BadRequestException({
            code: shared_1.ERROR_CODES.VALIDATION_FAILED,
            message: `origin is not a valid URL: ${raw}`,
        });
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new common_1.BadRequestException({
            code: shared_1.ERROR_CODES.VALIDATION_FAILED,
            message: 'origin must use http or https',
        });
    }
    if (url.username || url.password) {
        throw new common_1.BadRequestException({
            code: shared_1.ERROR_CODES.VALIDATION_FAILED,
            message: 'origin must not contain credentials',
        });
    }
    if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
        throw new common_1.BadRequestException({
            code: shared_1.ERROR_CODES.VALIDATION_FAILED,
            message: 'origin must not contain a path, query or fragment; use pathScope instead',
        });
    }
    return url.origin;
}
//# sourceMappingURL=websites.dto.js.map