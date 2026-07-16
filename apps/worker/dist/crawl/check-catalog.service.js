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
var CheckCatalogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckCatalogService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const seo_engine_1 = require("@seo-guardian/seo-engine");
/**
 * Seeds the `checks` catalog table from the single-source seo-engine catalog
 * (per-page + cross-page + runtime checks), so every check_id written to
 * page_issues has catalog metadata. Idempotent upsert; runs on worker boot.
 */
let CheckCatalogService = CheckCatalogService_1 = class CheckCatalogService {
    db;
    logger = new common_1.Logger(CheckCatalogService_1.name);
    constructor(db) {
        this.db = db;
    }
    async seed() {
        for (const c of seo_engine_1.CATALOG_CHECKS) {
            await this.db.query(`INSERT INTO checks (id, category, default_severity, default_weight, title, description,
                             seo_impact, business_impact, suggested_fix, doc_url, is_active)
         VALUES ($1,$2,$3::issue_severity,$4,$5,$6,$7,$8,$9,$10,true)
         ON CONFLICT (id) DO UPDATE SET
           category = EXCLUDED.category,
           default_severity = EXCLUDED.default_severity,
           default_weight = EXCLUDED.default_weight,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           seo_impact = EXCLUDED.seo_impact,
           business_impact = EXCLUDED.business_impact,
           suggested_fix = EXCLUDED.suggested_fix,
           doc_url = EXCLUDED.doc_url`, [
                c.id,
                c.category,
                c.defaultSeverity,
                c.weight,
                c.name,
                c.description,
                c.technicalExplanation,
                c.businessImpact,
                c.suggestedFix,
                c.docUrl ?? null,
            ]);
        }
        this.logger.log(`seeded ${seo_engine_1.CATALOG_CHECKS.length} checks into the catalog`);
        return seo_engine_1.CATALOG_CHECKS.length;
    }
};
exports.CheckCatalogService = CheckCatalogService;
exports.CheckCatalogService = CheckCatalogService = CheckCatalogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.Database])
], CheckCatalogService);
//# sourceMappingURL=check-catalog.service.js.map