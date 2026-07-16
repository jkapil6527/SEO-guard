"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.technicalChecks = void 0;
/** Transport / indexability Technical-SEO checks. */
const shared_1 = require("@seo-guardian/shared");
const factory_1 = require("./factory");
/** Normalizes a URL for self-vs-canonical comparison, or returns the raw input. */
function canonicalizeForCompare(url) {
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        return parsed.toString();
    }
    catch {
        return url;
    }
}
exports.technicalChecks = [
    (0, factory_1.createCheck)({
        id: 'technical.https.not_secure',
        name: 'Page not served over HTTPS',
        category: 'technical',
        defaultSeverity: shared_1.IssueSeverity.Critical,
        weight: 30,
        description: 'The final URL is served over insecure HTTP.',
        technicalExplanation: 'HTTPS is a confirmed ranking signal and a browser trust requirement. Insecure pages show "Not secure" warnings and are ineligible for many modern web features.',
        suggestedFix: 'Serve the page over HTTPS and redirect HTTP requests to the secure URL.',
        evaluate(a) {
            if (!a.https) {
                return [
                    {
                        status: 'fail',
                        message: `Page is served over HTTP: ${a.finalUrl}`,
                        affectedElement: a.finalUrl,
                    },
                ];
            }
            return (0, factory_1.passed)('Page is served over HTTPS.');
        },
    }),
    (0, factory_1.createCheck)({
        id: 'technical.https.mixed_content',
        name: 'Mixed content on secure page',
        category: 'technical',
        defaultSeverity: shared_1.IssueSeverity.High,
        weight: 15,
        description: 'An HTTPS page loads one or more subresources over insecure HTTP.',
        technicalExplanation: 'Mixed content is blocked or downgraded by browsers, breaking styles/scripts and removing the secure padlock, which erodes trust and can break functionality.',
        suggestedFix: 'Load all subresources (images, scripts, styles) over HTTPS.',
        evaluate(a) {
            if (a.mixedContentUrls.length > 0) {
                return a.mixedContentUrls.map((url) => ({
                    status: 'fail',
                    message: `Insecure subresource on HTTPS page: ${url}`,
                    affectedElement: url,
                }));
            }
            return (0, factory_1.passed)('No mixed content detected.');
        },
    }),
    (0, factory_1.createCheck)({
        id: 'technical.status.4xx',
        name: 'Page returns a 4xx status',
        category: 'technical',
        defaultSeverity: shared_1.IssueSeverity.Critical,
        weight: 30,
        description: 'The page responded with a 4xx client-error status.',
        technicalExplanation: 'A 4xx response (e.g. 404, 410) means the URL is unavailable. Indexed 4xx pages are dropped from search and any inbound links to them are wasted.',
        suggestedFix: 'Restore the page, or redirect the URL to a relevant working page.',
        evaluate(a) {
            if (a.httpStatus >= 400 && a.httpStatus < 500) {
                return [
                    {
                        status: 'fail',
                        message: `Page returned HTTP ${a.httpStatus}.`,
                        metadata: { httpStatus: a.httpStatus },
                    },
                ];
            }
            return (0, factory_1.passed)('Page did not return a 4xx status.');
        },
    }),
    (0, factory_1.createCheck)({
        id: 'technical.status.5xx',
        name: 'Page returns a 5xx status',
        category: 'technical',
        defaultSeverity: shared_1.IssueSeverity.Critical,
        weight: 30,
        description: 'The page responded with a 5xx server-error status.',
        technicalExplanation: 'A 5xx response indicates a server failure. Persistent 5xx errors cause search engines to drop the URL and can slow crawling of the whole site.',
        suggestedFix: 'Investigate and resolve the server error so the page returns 200.',
        evaluate(a) {
            if (a.httpStatus >= 500 && a.httpStatus < 600) {
                return [
                    {
                        status: 'fail',
                        message: `Page returned HTTP ${a.httpStatus}.`,
                        metadata: { httpStatus: a.httpStatus },
                    },
                ];
            }
            return (0, factory_1.passed)('Page did not return a 5xx status.');
        },
    }),
    (0, factory_1.createCheck)({
        id: 'technical.indexability.conflict',
        name: 'Noindex page has a canonical',
        category: 'technical',
        defaultSeverity: shared_1.IssueSeverity.Medium,
        weight: 10,
        description: 'A page marked noindex also declares a canonical to another URL.',
        technicalExplanation: 'noindex and rel="canonical" send contradictory signals: one asks to drop the page, the other to consolidate it. Search engines may honor either, making indexation unpredictable.',
        suggestedFix: 'Use either noindex or a canonical, not both; remove the conflicting signal.',
        evaluate(a) {
            const noindex = a.robotsMeta.noindex || a.robotsMeta.headerNoindex;
            if (!noindex || a.canonicals.length === 0) {
                return (0, factory_1.passed)('No conflicting indexability signals.');
            }
            const self = canonicalizeForCompare(a.finalUrl);
            const pointsElsewhere = a.canonicals.some((c) => canonicalizeForCompare(c) !== self);
            if (pointsElsewhere) {
                return [
                    {
                        status: 'fail',
                        message: 'Page is noindex but also declares a canonical, sending conflicting signals.',
                        metadata: { canonicals: a.canonicals, robots: a.robotsMeta.raw },
                    },
                ];
            }
            return (0, factory_1.passed)('No conflicting indexability signals.');
        },
    }),
    (0, factory_1.createCheck)({
        id: 'technical.redirect.present',
        name: 'URL redirects to another location',
        category: 'technical',
        defaultSeverity: shared_1.IssueSeverity.Low,
        weight: 4,
        description: 'The requested URL redirected before returning the final response.',
        technicalExplanation: 'Redirects add latency and dilute link equity. Internal links and sitemaps should point at the final URL to avoid unnecessary hops.',
        suggestedFix: 'Update references to point at the final destination URL.',
        evaluate(a) {
            const redirected = a.redirectChain.length > 0 || a.url !== a.finalUrl;
            if (redirected) {
                return [
                    {
                        status: 'warning',
                        message: `URL redirected from ${a.url} to ${a.finalUrl}.`,
                        metadata: { hops: a.redirectChain.length, chain: a.redirectChain },
                    },
                ];
            }
            return (0, factory_1.passed)('URL served directly without redirects.');
        },
    }),
];
//# sourceMappingURL=technical.js.map