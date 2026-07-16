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
exports.CursorQueryDto = void 0;
exports.encodeTimeCursor = encodeTimeCursor;
exports.decodeTimeCursor = decodeTimeCursor;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class CursorQueryDto {
    limit;
    cursor;
}
exports.CursorQueryDto = CursorQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 200, default: 50 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], CursorQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Opaque cursor from meta.nextCursor' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CursorQueryDto.prototype, "cursor", void 0);
function encodeTimeCursor(cursor) {
    return Buffer.from(JSON.stringify({ t: cursor.createdAt.toISOString(), i: cursor.id }), 'utf8').toString('base64url');
}
function decodeTimeCursor(raw) {
    try {
        const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
        const createdAt = new Date(parsed.t);
        if (Number.isNaN(createdAt.getTime()) || typeof parsed.i !== 'string')
            throw new Error();
        return { createdAt, id: parsed.i };
    }
    catch {
        throw new common_1.BadRequestException({
            code: shared_1.ERROR_CODES.VALIDATION_FAILED,
            message: 'Malformed pagination cursor',
        });
    }
}
//# sourceMappingURL=pagination.js.map