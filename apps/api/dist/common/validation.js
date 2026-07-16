"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationPipe = createValidationPipe;
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
function flatten(errors, parent = '') {
    return errors.flatMap((e) => {
        const field = parent ? `${parent}.${e.property}` : e.property;
        const own = Object.values(e.constraints ?? {}).map((message) => ({ field, message }));
        const nested = e.children?.length ? flatten(e.children, field) : [];
        return [...own, ...nested];
    });
}
/** Global validation pipe producing structured field errors for the problem-details filter. */
function createValidationPipe() {
    return new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        exceptionFactory: (errors) => new common_1.BadRequestException({
            code: shared_1.ERROR_CODES.VALIDATION_FAILED,
            message: 'Request validation failed',
            errors: flatten(errors),
        }),
    });
}
//# sourceMappingURL=validation.js.map