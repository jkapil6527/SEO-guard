"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDto = validateDto;
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
/**
 * Manual DTO validation for endpoints whose body shape is discriminated at
 * runtime (e.g. url-source creation). Mirrors the global pipe's error format.
 */
async function validateDto(cls, payload) {
    const instance = (0, class_transformer_1.plainToInstance)(cls, payload, { enableImplicitConversion: false });
    const errors = await (0, class_validator_1.validate)(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
        throw new common_1.BadRequestException({
            code: shared_1.ERROR_CODES.VALIDATION_FAILED,
            message: 'Request validation failed',
            errors: errors.flatMap((e) => Object.values(e.constraints ?? {}).map((message) => ({ field: e.property, message }))),
        });
    }
    return instance;
}
//# sourceMappingURL=validate-dto.js.map