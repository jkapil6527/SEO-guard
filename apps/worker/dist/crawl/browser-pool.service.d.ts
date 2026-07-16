import { ConfigService } from '@nestjs/config';
import type { OnApplicationShutdown } from '@nestjs/common';
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
export declare class BrowserPoolService implements OnApplicationShutdown {
    private readonly logger;
    private browser;
    private pagesRendered;
    private readonly recycleAfter;
    private readonly proxyUrl?;
    constructor(config: ConfigService<Env, true>);
    private getBrowser;
    /**
     * Renders a URL and returns the serialized post-JS DOM. Returns null on
     * timeout/crash so the caller can fall back to the static body.
     */
    render(url: string, userAgent: string, timeoutMs: number): Promise<string | null>;
    onApplicationShutdown(): Promise<void>;
}
