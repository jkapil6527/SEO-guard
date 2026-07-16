/**
 * Public contract of @seo-guardian/seo-engine. The engine is a deterministic,
 * zero-I/O function of fetched artifacts: html + context in, rule results out.
 */
import type { IssueSeverity } from '@seo-guardian/shared';
export interface PageContext {
    /** Normalized request URL. */
    url: string;
    /** URL after redirects (normalized). */
    finalUrl: string;
    httpStatus: number;
    headers: Record<string, string>;
    redirectChain: Array<{
        url: string;
        status: number;
    }>;
    rendered: boolean;
}
/**
 * Where an element sits in the document — lets an issue point at the exact node.
 *
 * Optional because snapshots taken before this existed have no location, and the
 * report must still render them rather than crash on historical data.
 */
export interface ElementLocation {
    /** CSS path, e.g. `main > article > h2:nth-of-type(3)`. */
    selector?: string;
    /** The element's own source HTML, truncated. */
    snippet?: string;
}
export interface HeadingItem extends ElementLocation {
    level: number;
    text: string;
}
export interface ImageItem extends ElementLocation {
    /**
     * Effective source. Falls back to a lazy-load attribute (`data-gsll-src`,
     * `data-src`, `srcset`, …) when the `src` attribute is absent, so a
     * lazy-loaded image is validated against the URL it will actually request
     * rather than being flagged broken for having no `src`.
     */
    src: string;
    alt: string | null;
    width: string | null;
    height: string | null;
    loading: string | null;
    /** True when `src` came from a lazy-load attribute, not the `src` attribute. */
    lazy?: boolean;
}
export interface LinkItem extends ElementLocation {
    /** Absolute, normalized target. */
    href: string;
    text: string;
    rel: string | null;
    internal: boolean;
    nofollow: boolean;
    targetBlank: boolean;
}
export interface RobotsMeta {
    raw: string | null;
    noindex: boolean;
    nofollow: boolean;
    /** X-Robots-Tag header, when present. */
    headerRaw: string | null;
    headerNoindex: boolean;
}
export interface PageArtifacts {
    url: string;
    finalUrl: string;
    httpStatus: number;
    rendered: boolean;
    redirectChain: Array<{
        url: string;
        status: number;
    }>;
    title: string | null;
    metaDescription: string | null;
    canonicals: string[];
    robotsMeta: RobotsMeta;
    charset: string | null;
    htmlLang: string | null;
    viewport: string | null;
    favicon: boolean;
    ogTags: Record<string, string>;
    twitterTags: Record<string, string>;
    hreflang: Array<{
        lang: string;
        href: string;
    }>;
    headings: HeadingItem[];
    images: ImageItem[];
    links: LinkItem[];
    wordCount: number;
    https: boolean;
    mixedContentUrls: string[];
    /** Response header echoes used by checks and incremental crawling. */
    etag: string | null;
    lastModified: string | null;
    contentType: string | null;
    /** md5 of normalized values; null when the value is absent. Drives cross-page duplicate SQL. */
    titleHash: string | null;
    descriptionHash: string | null;
    h1Hash: string | null;
    /** First H1 text (duplicate-group samples). */
    h1Text: string | null;
}
/** html → artifacts. Pure; safe to run on untrusted markup. */
export type ExtractArtifacts = (html: string, ctx: PageContext) => PageArtifacts;
export type RuleStatus = 'pass' | 'fail' | 'warning' | 'not_applicable';
export interface RuleResult {
    ruleId: string;
    ruleName: string;
    severity: IssueSeverity;
    status: RuleStatus;
    message: string;
    technicalExplanation: string;
    suggestedFix: string;
    /** CSS-selector-ish or value locating the offending element, when known. */
    affectedElement?: string;
    metadata?: Record<string, unknown>;
}
export interface SiteContext {
    origin: string;
    pathScope: string;
    /** Link verification results keyed by normalized URL (available at finalize; per-page runs may omit). */
    linkStatuses?: Map<string, {
        status: number | null;
        ok: boolean;
        redirectHops: number;
    }>;
}
export type CheckCategory = 'meta' | 'headings' | 'images' | 'links' | 'technical' | 'social';
export interface CheckDefinition {
    id: string;
    name: string;
    category: CheckCategory;
    defaultSeverity: IssueSeverity;
    /** Score deduction weight (see computePageScore). */
    weight: number;
    description: string;
    technicalExplanation: string;
    suggestedFix: string;
    docUrl?: string;
    run(artifacts: PageArtifacts, site: SiteContext): RuleResult[];
}
export interface EngineOverrides {
    disabledCheckIds?: ReadonlySet<string>;
    severityByCheckId?: ReadonlyMap<string, IssueSeverity>;
}
/**
 * Cross-page checks evaluated by the finalizer in SQL, not per page. Exported
 * so persistence uses catalog severities/copy rather than hardcoding.
 */
export interface CrossPageCheckMeta {
    id: string;
    name: string;
    defaultSeverity: IssueSeverity;
    weight: number;
    description: string;
    suggestedFix: string;
}
