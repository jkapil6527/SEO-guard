"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlsModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
const crawl_progress_service_1 = require("./crawl-progress.service");
const crawl_reads_controller_1 = require("./crawl-reads.controller");
const crawls_controller_1 = require("./crawls.controller");
const crawls_service_1 = require("./crawls.service");
const redis_provider_1 = require("./redis.provider");
let CrawlsModule = class CrawlsModule {
};
exports.CrawlsModule = CrawlsModule;
exports.CrawlsModule = CrawlsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // Producers for the crawl queues (root BullMQ connection configured in JobsModule).
            bullmq_1.BullModule.registerQueue({ name: shared_1.QUEUES.CRAWL_ORCHESTRATE }, { name: shared_1.QUEUES.PAGE_FETCH }),
        ],
        controllers: [crawls_controller_1.CrawlsController, crawl_reads_controller_1.CrawlReadsController],
        providers: [crawls_service_1.CrawlsService, crawl_progress_service_1.CrawlProgressService, redis_provider_1.crawlRedisProvider, redis_provider_1.crawlRedisSubProvider],
        exports: [crawls_service_1.CrawlsService],
    })
], CrawlsModule);
//# sourceMappingURL=crawls.module.js.map