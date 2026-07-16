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
exports.SitemapGroupsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const db_1 = require("@seo-guardian/db");
const crawler_core_1 = require("@seo-guardian/crawler-core");
const shared_1 = require("@seo-guardian/shared");
const crawls_service_1 = require("../crawls/crawls.service");
function slugify(value) {
    return (value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'category');
}
let SitemapGroupsService = class SitemapGroupsService {
    groups;
    websites;
    crawls;
    config;
    constructor(groups, websites, crawls, config) {
        this.groups = groups;
        this.websites = websites;
        this.crawls = crawls;
        this.config = config;
    }
    listByProject(projectId) {
        return this.groups.listSummariesByProject(projectId);
    }
    async get(groupId) {
        const group = await this.groups.findById(groupId);
        if (!group) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'category not found' });
        }
        return group;
    }
    trend(groupId) {
        return this.groups.trend(groupId);
    }
    async create(input) {
        const website = await this.websites.findById(input.websiteId);
        if (!website) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'website not found' });
        }
        const sitemapUrl = input.sitemapUrl
            ? this.assertSameOrigin(input.sitemapUrl, website.origin)
            : null;
        // Slugs are unique per website; disambiguate rather than reject, so two
        // websites in a project can both have a "News" category.
        const existing = await this.groups.listByWebsite(input.websiteId);
        const base = slugify(input.name);
        let slug = base;
        let n = 2;
        while (existing.some((g) => g.slug.toLowerCase() === slug.toLowerCase())) {
            slug = `${base}-${n++}`;
        }
        return this.groups.create({
            websiteId: input.websiteId,
            name: input.name.trim(),
            slug,
            sitemapUrl,
            createdBy: input.actor.id,
        });
    }
    async update(groupId, patch) {
        const group = await this.get(groupId);
        if (patch.sitemapUrl) {
            const website = await this.websites.findById(group.websiteId);
            if (website)
                this.assertSameOrigin(patch.sitemapUrl, website.origin);
        }
        const updated = await this.groups.update(groupId, patch);
        if (!updated) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'category not found' });
        }
        return updated;
    }
    async remove(groupId) {
        await this.get(groupId);
        await this.groups.remove(groupId);
    }
    /**
     * Parse a sitemap and report what it holds — URL count, how many nested
     * sitemaps it spans, and a sample — so the user can confirm before committing
     * to a crawl of it.
     */
    async preview(groupId, override) {
        const group = await this.get(groupId);
        const website = await this.websites.findById(group.websiteId);
        if (!website) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'website not found' });
        }
        const target = override ?? group.sitemapUrl;
        if (!target) {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                message: 'This category has no sitemap URL yet',
                errors: [{ field: 'sitemapUrl', message: 'Add a sitemap URL to crawl this category' }],
            });
        }
        const sitemapUrl = this.assertSameOrigin(target, website.origin);
        const fetcher = new crawler_core_1.SafeFetcher({
            userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
            timeoutMs: 20_000,
        });
        const tree = await (0, crawler_core_1.fetchSitemapTree)(sitemapUrl, fetcher, { maxUrls: 50_000 });
        const urls = tree.entries
            .map((e) => (0, crawler_core_1.normalizeUrl)(e.url))
            .filter((u) => u !== null);
        return {
            sitemapUrl,
            total: urls.length,
            sitemapCount: tree.sitemapCount,
            truncated: tree.truncated,
            errors: tree.errors.length,
            sample: urls.slice(0, 8),
        };
    }
    /** Start a crawl covering exactly this category's sitemap. */
    async startCrawl(groupId, mode, ctx) {
        const group = await this.get(groupId);
        if (!group.sitemapUrl) {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                message: 'This category has no sitemap URL yet',
                errors: [{ field: 'sitemapUrl', message: 'Add a sitemap URL to crawl this category' }],
            });
        }
        const crawl = await this.crawls.start(group.websiteId, mode, shared_1.CrawlScope.Group, undefined, ctx, groupId);
        return { crawlId: crawl.id, status: crawl.status };
    }
    /**
     * A sitemap must belong to the website it categorises — otherwise the URL is an
     * arbitrary fetch target chosen by the caller.
     */
    assertSameOrigin(sitemapUrl, origin) {
        let parsed;
        try {
            parsed = new URL(sitemapUrl.trim());
        }
        catch {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                message: 'Enter a valid http(s) sitemap URL',
                errors: [{ field: 'sitemapUrl', message: 'Enter a valid http(s) URL' }],
            });
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                message: 'Enter a valid http(s) sitemap URL',
                errors: [{ field: 'sitemapUrl', message: 'Enter a valid http(s) URL' }],
            });
        }
        if (parsed.origin !== new URL(origin).origin) {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                message: `The sitemap must be on this website's origin (${origin})`,
                errors: [{ field: 'sitemapUrl', message: `The URL must start with ${origin}` }],
            });
        }
        return parsed.toString();
    }
};
exports.SitemapGroupsService = SitemapGroupsService;
exports.SitemapGroupsService = SitemapGroupsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.SitemapGroupsRepository,
        db_1.WebsitesRepository,
        crawls_service_1.CrawlsService,
        config_1.ConfigService])
], SitemapGroupsService);
//# sourceMappingURL=sitemap-groups.service.js.map