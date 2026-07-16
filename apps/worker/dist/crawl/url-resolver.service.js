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
var UrlResolverService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlResolverService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const db_1 = require("@seo-guardian/db");
const crawler_core_1 = require("@seo-guardian/crawler-core");
const sync_1 = require("csv-parse/sync");
/**
 * Resolves a crawl's starting URL set from all active sources of a website:
 * manual lists, CSV objects, sitemaps (recursed), and discovery seeds.
 * Normalizes and de-duplicates. Pure resolution — enqueuing happens in the
 * orchestrator.
 */
let UrlResolverService = UrlResolverService_1 = class UrlResolverService {
    sources;
    config;
    logger = new common_1.Logger(UrlResolverService_1.name);
    s3;
    uploadsBucket;
    constructor(sources, config) {
        this.sources = sources;
        this.config = config;
        const endpoint = config.get('S3_ENDPOINT', { infer: true });
        this.uploadsBucket = 'seo-guardian-uploads';
        this.s3 = new client_s3_1.S3Client({
            region: config.get('S3_REGION', { infer: true }),
            ...(endpoint ? { endpoint } : {}),
            forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
            credentials: {
                accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
                secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
            },
        });
    }
    async resolve(websiteId, crawlConfig, fetcher) {
        const sources = (await this.sources.listByWebsite(websiteId)).filter((s) => s.isActive);
        const seeds = new Map();
        for (const source of sources) {
            try {
                const resolved = await this.resolveSource(source, crawlConfig, fetcher);
                for (const seed of resolved) {
                    const existing = seeds.get(seed.url);
                    if (!existing)
                        seeds.set(seed.url, seed);
                    else if (seed.allowDiscovery)
                        existing.allowDiscovery = true;
                }
            }
            catch (err) {
                this.logger.error({ err, sourceId: source.id, type: source.type }, 'source resolution failed');
            }
        }
        return [...seeds.values()];
    }
    async resolveSource(source, crawlConfig, fetcher) {
        const cfg = source.config;
        switch (cfg.kind) {
            case 'manual':
                return this.normalizeList(cfg.urls, false);
            case 'discovery':
                return this.normalizeList(cfg.seeds, true);
            case 'csv':
                return this.normalizeList(await this.readCsvUrls(cfg.objectKey, cfg.urlColumn), false);
            case 'sitemap': {
                const tree = await (0, crawler_core_1.fetchSitemapTree)(cfg.sitemapUrl, fetcher, {
                    maxUrls: crawlConfig.discoveryMaxPages,
                });
                if (tree.errors.length > 0) {
                    this.logger.warn({ sourceId: source.id, errors: tree.errors.length }, 'sitemap partial errors');
                }
                return this.normalizeEntries(tree.entries);
            }
            default:
                return [];
        }
    }
    /**
     * Resolve exactly one sitemap — the URL set of a single category. Bypasses
     * url_sources entirely: a group owns its sitemap URL directly.
     */
    async resolveSitemap(sitemapUrl, crawlConfig, fetcher, maxUrls) {
        const tree = await (0, crawler_core_1.fetchSitemapTree)(sitemapUrl, fetcher, {
            maxUrls: maxUrls ?? crawlConfig.discoveryMaxPages,
        });
        if (tree.errors.length > 0) {
            this.logger.warn({ sitemapUrl, errors: tree.errors.length }, 'sitemap partial errors');
        }
        return this.normalizeEntries(tree.entries);
    }
    /** Parse a sitemap and report what it contains, without starting a crawl. */
    async previewSitemap(sitemapUrl, crawlConfig, fetcher, sampleSize = 10) {
        const tree = await (0, crawler_core_1.fetchSitemapTree)(sitemapUrl, fetcher, {
            maxUrls: crawlConfig.discoveryMaxPages,
        });
        const seeds = this.normalizeEntries(tree.entries);
        return {
            urls: seeds.slice(0, sampleSize).map((s) => s.url),
            total: seeds.length,
            sitemapCount: tree.sitemapCount ?? 1,
            truncated: tree.truncated,
            errors: tree.errors.length,
        };
    }
    normalizeEntries(entries) {
        const out = [];
        for (const entry of entries) {
            const normalized = (0, crawler_core_1.normalizeUrl)(entry.url);
            if (!normalized)
                continue;
            const lastmod = entry.lastmod ? new Date(entry.lastmod) : null;
            out.push({
                url: normalized,
                allowDiscovery: false,
                lastmod: lastmod && !Number.isNaN(lastmod.getTime()) ? lastmod : null,
            });
        }
        return out;
    }
    normalizeList(urls, allowDiscovery) {
        const out = [];
        for (const raw of urls) {
            const normalized = (0, crawler_core_1.normalizeUrl)(raw);
            if (normalized)
                out.push({ url: normalized, allowDiscovery });
        }
        return out;
    }
    async readCsvUrls(objectKey, urlColumn) {
        const res = await this.s3.send(new client_s3_1.GetObjectCommand({ Bucket: this.uploadsBucket, Key: objectKey }));
        const body = await res.Body?.transformToByteArray();
        if (!body)
            return [];
        const records = (0, sync_1.parse)(Buffer.from(body), {
            columns: true,
            bom: true,
            trim: true,
            skip_empty_lines: true,
            relax_column_count: true,
        });
        return records.map((r) => r[urlColumn] ?? '').filter(Boolean);
    }
};
exports.UrlResolverService = UrlResolverService;
exports.UrlResolverService = UrlResolverService = UrlResolverService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.UrlSourcesRepository,
        config_1.ConfigService])
], UrlResolverService);
//# sourceMappingURL=url-resolver.service.js.map