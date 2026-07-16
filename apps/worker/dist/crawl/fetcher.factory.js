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
exports.FetcherFactory = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crawler_core_1 = require("@seo-guardian/crawler-core");
/**
 * Builds SSRF-guarded fetchers. In tests, CRAWLER_ALLOW_PRIVATE_TARGETS lets
 * the guard reach a localhost fixture server; in production it is empty, so
 * private address space stays blocked.
 */
let FetcherFactory = class FetcherFactory {
    config;
    allowPrivateTargets;
    constructor(config) {
        this.config = config;
        this.allowPrivateTargets = config
            .get('CRAWLER_ALLOW_PRIVATE_TARGETS', { infer: true })
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
    }
    create(crawlConfig) {
        return new crawler_core_1.SafeFetcher({
            userAgent: crawlConfig.userAgent,
            timeoutMs: crawlConfig.timeoutMs,
            maxRedirects: crawlConfig.maxRedirects,
            allowPrivateTargets: this.allowPrivateTargets,
        });
    }
};
exports.FetcherFactory = FetcherFactory;
exports.FetcherFactory = FetcherFactory = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FetcherFactory);
//# sourceMappingURL=fetcher.factory.js.map