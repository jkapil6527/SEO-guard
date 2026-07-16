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
exports.SourcesService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const shared_1 = require("@seo-guardian/shared");
const audit_service_1 = require("../audit/audit.service");
const csv_service_1 = require("./csv.service");
const storage_service_1 = require("./storage.service");
let SourcesService = class SourcesService {
    sources;
    websites;
    csv;
    storage;
    audit;
    constructor(sources, websites, csv, storage, audit) {
        this.sources = sources;
        this.websites = websites;
        this.csv = csv;
        this.storage = storage;
        this.audit = audit;
    }
    list(websiteId) {
        return this.sources.listByWebsite(websiteId);
    }
    async createManual(websiteId, dto, ctx) {
        const urls = [...new Set(dto.urls.map((u) => u.trim()).filter(Boolean))];
        const invalid = urls.filter((u) => !(0, csv_service_1.isHttpUrl)(u));
        if (invalid.length > 0) {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                message: `Invalid URLs: ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '…' : ''}`,
            });
        }
        return this.create(websiteId, shared_1.UrlSourceType.Manual, { kind: 'manual', urls }, ctx);
    }
    async createSitemap(websiteId, dto, ctx) {
        return this.create(websiteId, shared_1.UrlSourceType.Sitemap, { kind: 'sitemap', sitemapUrl: dto.sitemapUrl }, ctx);
    }
    async createDiscovery(websiteId, dto, ctx) {
        const website = await this.websites.findById(websiteId);
        if (!website) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'website not found' });
        }
        const seeds = [...new Set(dto.seeds.map((s) => s.trim()).filter(Boolean))];
        const offOrigin = seeds.filter((s) => !(0, csv_service_1.isHttpUrl)(s) || new URL(s).origin !== website.origin);
        if (offOrigin.length > 0) {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                message: `Discovery seeds must be valid URLs on ${website.origin}; rejected: ${offOrigin
                    .slice(0, 5)
                    .join(', ')}`,
            });
        }
        return this.create(websiteId, shared_1.UrlSourceType.Discovery, { kind: 'discovery', seeds, maxDepth: dto.maxDepth ?? 3, maxPages: dto.maxPages ?? 10_000 }, ctx);
    }
    async createFromCsv(websiteId, file, urlColumn, ctx) {
        const allowedTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'text/plain',
            'application/octet-stream',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.CSV_INVALID,
                message: `Unsupported content type '${file.mimetype}'; upload a CSV file`,
            });
        }
        const result = await this.csv.validateUrlCsv(file.buffer, urlColumn);
        const objectKey = `csv-sources/${websiteId}/${(0, node_crypto_1.randomUUID)()}.csv`;
        await this.storage.putObject(objectKey, file.buffer, 'text/csv');
        return this.create(websiteId, shared_1.UrlSourceType.Csv, {
            kind: 'csv',
            objectKey,
            originalFilename: file.originalname.slice(0, 300),
            urlColumn: result.urlColumn,
            rowCount: result.rowCount,
        }, ctx);
    }
    async setActive(sourceId, isActive, ctx) {
        const before = await this.getById(sourceId);
        const updated = await this.sources.setActive(sourceId, isActive);
        if (!updated) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'source not found' });
        }
        await this.recordAudit(before.websiteId, shared_1.AuditAction.Update, updated.id, ctx, {
            before: { isActive: before.isActive },
            after: { isActive: updated.isActive },
        });
        return updated;
    }
    async delete(sourceId, ctx) {
        const source = await this.getById(sourceId);
        await this.sources.delete(sourceId);
        if (source.config.kind === 'csv') {
            await this.storage.deleteObjectSafe(source.config.objectKey);
        }
        await this.recordAudit(source.websiteId, shared_1.AuditAction.Delete, sourceId, ctx, {
            before: { type: source.type, config: source.config },
        });
    }
    async getById(sourceId) {
        const source = await this.sources.findById(sourceId);
        if (!source) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'source not found' });
        }
        return source;
    }
    async create(websiteId, type, config, ctx) {
        const source = await this.sources.create({
            websiteId,
            type,
            config,
            createdBy: ctx.actor.id,
        });
        await this.recordAudit(websiteId, shared_1.AuditAction.Create, source.id, ctx, {
            after: { type, config: config },
        });
        return source;
    }
    async recordAudit(websiteId, action, entityId, ctx, diff) {
        const projectId = await this.websites.projectIdOf(websiteId);
        await this.audit.record({
            ...ctx,
            projectId,
            action,
            entity: 'url_source',
            entityId,
            before: diff.before ?? null,
            after: diff.after ?? null,
        });
    }
};
exports.SourcesService = SourcesService;
exports.SourcesService = SourcesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.UrlSourcesRepository,
        db_1.WebsitesRepository,
        csv_service_1.CsvService,
        storage_service_1.StorageService,
        audit_service_1.AuditService])
], SourcesService);
//# sourceMappingURL=sources.service.js.map