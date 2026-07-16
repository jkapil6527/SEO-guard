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
var PartitionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartitionService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const PARTITIONED_TABLES = ['page_snapshots', 'page_issues', 'schema_entities', 'crawl_changes'];
const MONTHS_AHEAD = 2;
/** Keeps monthly partitions provisioned ahead of time (see docs/03-database.md §4). */
let PartitionService = PartitionService_1 = class PartitionService {
    db;
    logger = new common_1.Logger(PartitionService_1.name);
    constructor(db) {
        this.db = db;
    }
    async ensurePartitions() {
        let created = 0;
        for (const table of PARTITIONED_TABLES) {
            const rows = await this.db.query('SELECT ensure_monthly_partitions($1::regclass, $2) AS created', [table, MONTHS_AHEAD]);
            created += rows[0]?.created ?? 0;
        }
        if (created > 0) {
            this.logger.log(`created ${created} new monthly partition(s)`);
        }
        return created;
    }
};
exports.PartitionService = PartitionService;
exports.PartitionService = PartitionService = PartitionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.Database])
], PartitionService);
//# sourceMappingURL=partition.service.js.map