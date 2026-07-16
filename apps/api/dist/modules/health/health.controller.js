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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const db_1 = require("@seo-guardian/db");
const shared_1 = require("@seo-guardian/shared");
const decorators_1 = require("../../common/decorators");
const jobs_service_1 = require("../jobs/jobs.service");
let HealthController = class HealthController {
    db;
    jobs;
    constructor(db, jobs) {
        this.db = db;
        this.jobs = jobs;
    }
    health() {
        return { status: 'ok' };
    }
    async ready() {
        const [database, redis] = await Promise.all([
            this.db.healthCheck().catch(() => false),
            this.jobs.pingQueues(),
        ]);
        if (!database || !redis) {
            throw new common_1.ServiceUnavailableException({
                code: shared_1.ERROR_CODES.INTERNAL,
                message: `not ready: database=${database ? 'ok' : 'down'} redis=${redis ? 'ok' : 'down'}`,
            });
        }
        return { status: 'ready', database: 'ok', redis: 'ok' };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('health'),
    (0, swagger_1.ApiOperation)({ summary: 'Liveness probe' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "health", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('ready'),
    (0, swagger_1.ApiOperation)({ summary: 'Readiness probe (PostgreSQL + Redis)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "ready", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('health'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [db_1.Database,
        jobs_service_1.JobsService])
], HealthController);
//# sourceMappingURL=health.controller.js.map