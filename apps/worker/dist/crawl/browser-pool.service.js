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
var BrowserPoolService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserPoolService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const playwright_1 = require("playwright");
/**
 * Lazily-started shared Chromium. Contexts are created per job and recycled
 * after a fixed number of pages to bound memory (docs/05 §4). Images/fonts/
 * media are blocked — SEO validation needs the DOM, not pixels.
 *
 * SSRF note: the in-process SafeFetcher guard cannot see browser navigation, so
 * a client-side redirect during render could reach internal hosts. When an
 * egress proxy is configured, all browser traffic is routed through it and the
 * proxy enforces the allow/deny policy centrally (docs/09 §Egress proxy).
 */
let BrowserPoolService = BrowserPoolService_1 = class BrowserPoolService {
    logger = new common_1.Logger(BrowserPoolService_1.name);
    browser = null;
    pagesRendered = 0;
    recycleAfter = 50;
    proxyUrl;
    constructor(config) {
        this.proxyUrl = config.get('EGRESS_PROXY_URL', { infer: true });
    }
    async getBrowser() {
        if (this.browser && this.browser.isConnected() && this.pagesRendered < this.recycleAfter) {
            return this.browser;
        }
        if (this.browser) {
            await this.browser.close().catch(() => undefined);
            this.pagesRendered = 0;
        }
        this.browser = await playwright_1.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
            ...(this.proxyUrl ? { proxy: { server: this.proxyUrl } } : {}),
        });
        this.logger.log(`chromium launched${this.proxyUrl ? ' (via egress proxy)' : ''}`);
        return this.browser;
    }
    /**
     * Renders a URL and returns the serialized post-JS DOM. Returns null on
     * timeout/crash so the caller can fall back to the static body.
     */
    async render(url, userAgent, timeoutMs) {
        let context = null;
        try {
            const browser = await this.getBrowser();
            context = await browser.newContext({ userAgent, javaScriptEnabled: true });
            await context.route('**/*', (route) => {
                const type = route.request().resourceType();
                if (type === 'image' || type === 'font' || type === 'media')
                    return route.abort();
                return route.continue();
            });
            const page = await context.newPage();
            await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
            const html = await page.content();
            this.pagesRendered += 1;
            return html;
        }
        catch (err) {
            this.logger.warn({ err, url }, 'render failed; caller falls back to static html');
            return null;
        }
        finally {
            await context?.close().catch(() => undefined);
        }
    }
    async onApplicationShutdown() {
        await this.browser?.close().catch(() => undefined);
    }
};
exports.BrowserPoolService = BrowserPoolService;
exports.BrowserPoolService = BrowserPoolService = BrowserPoolService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BrowserPoolService);
//# sourceMappingURL=browser-pool.service.js.map