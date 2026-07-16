import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OnApplicationShutdown } from '@nestjs/common';
import { chromium } from 'playwright';
import type { Browser, BrowserContext } from 'playwright';
import type { Env } from '../config/env';

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
@Injectable()
export class BrowserPoolService implements OnApplicationShutdown {
  private readonly logger = new Logger(BrowserPoolService.name);
  private browser: Browser | null = null;
  private pagesRendered = 0;
  private readonly recycleAfter = 50;
  private readonly proxyUrl?: string;

  constructor(config: ConfigService<Env, true>) {
    this.proxyUrl = config.get('EGRESS_PROXY_URL', { infer: true });
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected() && this.pagesRendered < this.recycleAfter) {
      return this.browser;
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.pagesRendered = 0;
    }
    this.browser = await chromium.launch({
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
  async render(url: string, userAgent: string, timeoutMs: number): Promise<string | null> {
    let context: BrowserContext | null = null;
    try {
      const browser = await this.getBrowser();
      context = await browser.newContext({ userAgent, javaScriptEnabled: true });
      await context.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (type === 'image' || type === 'font' || type === 'media') return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
      const html = await page.content();
      this.pagesRendered += 1;
      return html;
    } catch (err) {
      this.logger.warn({ err, url }, 'render failed; caller falls back to static html');
      return null;
    } finally {
      await context?.close().catch(() => undefined);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
  }
}
