"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ProblemDetailsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProblemDetailsFilter = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const shared_1 = require("@seo-guardian/shared");
const TITLES = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    413: 'Payload Too Large',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
};
/** Normalizes every error into an RFC 7807 problem-details response. */
let ProblemDetailsFilter = ProblemDetailsFilter_1 = class ProblemDetailsFilter {
    logger = new common_1.Logger(ProblemDetailsFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let code = shared_1.ERROR_CODES.INTERNAL;
        let detail;
        let errors;
        if (exception instanceof throttler_1.ThrottlerException) {
            status = common_1.HttpStatus.TOO_MANY_REQUESTS;
            code = shared_1.ERROR_CODES.RATE_LIMITED;
            detail = 'Too many requests; slow down.';
        }
        else if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const body = exception.getResponse();
            if (typeof body === 'string') {
                detail = body;
            }
            else if (body && typeof body === 'object') {
                const b = body;
                code = typeof b.code === 'string' ? b.code : defaultCode(status);
                errors = Array.isArray(b.errors) ? b.errors : undefined;
                if (typeof b.message === 'string')
                    detail = b.message;
                else if (Array.isArray(b.message))
                    detail = b.message.join('; ');
                else if (typeof b.detail === 'string')
                    detail = b.detail;
            }
        }
        else {
            this.logger.error({ err: exception, path: req.url, method: req.method }, 'Unhandled exception');
            detail = 'An unexpected error occurred.';
        }
        if (code === shared_1.ERROR_CODES.INTERNAL && status !== common_1.HttpStatus.INTERNAL_SERVER_ERROR) {
            code = defaultCode(status);
        }
        const problem = {
            type: 'about:blank',
            title: TITLES[status] ?? 'Error',
            status,
            code,
            ...(detail ? { detail } : {}),
            ...(errors ? { errors } : {}),
        };
        res.status(status).type('application/problem+json').json(problem);
    }
};
exports.ProblemDetailsFilter = ProblemDetailsFilter;
exports.ProblemDetailsFilter = ProblemDetailsFilter = ProblemDetailsFilter_1 = __decorate([
    (0, common_1.Catch)()
], ProblemDetailsFilter);
function defaultCode(status) {
    switch (status) {
        case 400:
        case 422:
            return shared_1.ERROR_CODES.VALIDATION_FAILED;
        case 401:
            return shared_1.ERROR_CODES.INVALID_CREDENTIALS;
        case 403:
            return shared_1.ERROR_CODES.FORBIDDEN;
        case 404:
            return shared_1.ERROR_CODES.NOT_FOUND;
        case 409:
            return shared_1.ERROR_CODES.CONFLICT;
        case 429:
            return shared_1.ERROR_CODES.RATE_LIMITED;
        default:
            return shared_1.ERROR_CODES.INTERNAL;
    }
}
//# sourceMappingURL=problem-details.filter.js.map