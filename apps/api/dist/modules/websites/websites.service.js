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
exports.WebsitesService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const shared_1 = require("@seo-guardian/shared");
const audit_service_1 = require("../audit/audit.service");
const websites_dto_1 = require("./websites.dto");
function isUniqueViolation(err) {
    return typeof err === 'object' && err !== null && err.code === '23505';
}
let WebsitesService = class WebsitesService {
    websites;
    audit;
    constructor(websites, audit) {
        this.websites = websites;
        this.audit = audit;
    }
    list(projectId) {
        return this.websites.listByProject(projectId);
    }
    async getById(id) {
        const website = await this.websites.findById(id);
        if (!website) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'website not found' });
        }
        return website;
    }
    async create(projectId, dto, ctx) {
        const origin = (0, websites_dto_1.normalizeOrigin)(dto.origin);
        try {
            const website = await this.websites.create({
                projectId,
                name: dto.name,
                origin,
                pathScope: dto.pathScope,
                settings: dto.settings,
            });
            await this.audit.record({
                ...ctx,
                projectId,
                action: shared_1.AuditAction.Create,
                entity: 'website',
                entityId: website.id,
                after: { name: website.name, origin: website.origin, pathScope: website.pathScope },
            });
            return website;
        }
        catch (err) {
            if (isUniqueViolation(err)) {
                throw new common_1.ConflictException({
                    code: shared_1.ERROR_CODES.CONFLICT,
                    message: `Website ${origin}${dto.pathScope ?? '/'} already exists in this project`,
                });
            }
            throw err;
        }
    }
    async update(id, dto, ctx) {
        const before = await this.getById(id);
        const updated = await this.websites.update(id, dto);
        if (!updated) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'website not found' });
        }
        await this.audit.record({
            ...ctx,
            projectId: before.projectId,
            action: shared_1.AuditAction.Update,
            entity: 'website',
            entityId: id,
            before: { name: before.name, isActive: before.isActive, settings: before.settings },
            after: { name: updated.name, isActive: updated.isActive, settings: updated.settings },
        });
        return updated;
    }
    async delete(id, ctx) {
        const website = await this.getById(id);
        await this.websites.delete(id);
        await this.audit.record({
            ...ctx,
            projectId: website.projectId,
            action: shared_1.AuditAction.Delete,
            entity: 'website',
            entityId: id,
            before: { name: website.name, origin: website.origin },
        });
    }
};
exports.WebsitesService = WebsitesService;
exports.WebsitesService = WebsitesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.WebsitesRepository,
        audit_service_1.AuditService])
], WebsitesService);
//# sourceMappingURL=websites.service.js.map