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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
/**
 * Records every create/update/delete. Failures are logged, never propagated:
 * an audit-log outage must not take down mutations, and the write path is
 * append-only so partial failure cannot corrupt state.
 */
let AuditService = AuditService_1 = class AuditService {
    auditLogs;
    logger = new common_1.Logger(AuditService_1.name);
    constructor(auditLogs) {
        this.auditLogs = auditLogs;
    }
    async record(entry) {
        try {
            await this.auditLogs.record({
                userId: entry.actor.id,
                projectId: entry.projectId,
                action: `${entry.entity}.${entry.action}`,
                entity: entry.entity,
                entityId: entry.entityId,
                before: entry.before ?? null,
                after: entry.after ?? null,
                ip: entry.ip,
            });
        }
        catch (err) {
            this.logger.error({ err, entry: { ...entry, before: undefined, after: undefined } }, 'audit write failed');
        }
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.AuditLogsRepository])
], AuditService);
//# sourceMappingURL=audit.service.js.map