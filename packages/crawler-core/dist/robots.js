"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRobots = parseRobots;
/**
 * Compiles a robots.txt path pattern: `*` matches any character sequence,
 * a trailing `$` anchors the match at the end of the path.
 */
function patternToRegex(pattern) {
    let body = pattern;
    let anchored = false;
    if (body.endsWith('$')) {
        anchored = true;
        body = body.slice(0, -1);
    }
    const escaped = body
        .split('*')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*');
    return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
}
/** Extracts path+query from a full URL; path-only strings pass through. */
function pathOf(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.pathname}${parsed.search}`;
    }
    catch {
        return url.startsWith('/') ? url : `/${url}`;
    }
}
/**
 * Parses robots.txt content into queryable rules.
 *
 * - Groups are formed by one or more consecutive `User-agent` lines followed
 *   by their rules; rules appearing before any `User-agent` line are ignored.
 * - `isAllowed` picks the most specific group: the longest user-agent token
 *   that is a case-insensitive substring of the caller's user agent; groups
 *   sharing that winning specificity are merged. `*` groups are the fallback;
 *   with no applicable group everything is allowed.
 * - Longest pattern wins between Allow and Disallow; on a tie Allow wins.
 *   An empty `Disallow:` value imposes no restriction.
 * - `Crawl-delay` (seconds) is exposed as milliseconds per group.
 * - All absolute `Sitemap:` URLs are collected regardless of grouping.
 */
function parseRobots(txt) {
    const groups = [];
    const sitemaps = [];
    let current = null;
    // True while consecutive User-agent lines are still being collected for
    // `current`; the first rule line closes the collection.
    let collectingAgents = false;
    const text = txt.charCodeAt(0) === 0xfeff ? txt.slice(1) : txt;
    for (const rawLine of text.split(/\r\n|\r|\n/)) {
        const hashIndex = rawLine.indexOf('#');
        const line = (hashIndex === -1 ? rawLine : rawLine.slice(0, hashIndex)).trim();
        if (line === '') {
            continue;
        }
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
            continue;
        }
        const field = line.slice(0, colonIndex).trim().toLowerCase();
        const value = line.slice(colonIndex + 1).trim();
        switch (field) {
            case 'user-agent': {
                if (!collectingAgents || current === null) {
                    current = { userAgents: [], rules: [], crawlDelayMs: null };
                    groups.push(current);
                    collectingAgents = true;
                }
                if (value !== '') {
                    current.userAgents.push(value.toLowerCase());
                }
                break;
            }
            case 'allow':
            case 'disallow': {
                collectingAgents = false;
                if (current === null || value === '') {
                    break; // no open group, or empty Disallow (== no restriction)
                }
                current.rules.push({
                    allow: field === 'allow',
                    pattern: value,
                    regex: patternToRegex(value),
                });
                break;
            }
            case 'crawl-delay': {
                collectingAgents = false;
                if (current === null) {
                    break;
                }
                const seconds = Number(value);
                if (Number.isFinite(seconds) && seconds >= 0) {
                    current.crawlDelayMs = Math.round(seconds * 1000);
                }
                break;
            }
            case 'sitemap': {
                try {
                    const parsed = new URL(value);
                    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                        sitemaps.push(parsed.toString());
                    }
                }
                catch {
                    // relative or malformed sitemap URLs are ignored
                }
                break;
            }
            default:
                // Unknown directives neither open nor close a group.
                break;
        }
    }
    const matchGroups = (userAgent) => {
        const ua = userAgent.toLowerCase();
        let best = -1;
        for (const group of groups) {
            for (const token of group.userAgents) {
                if (token === '*') {
                    best = Math.max(best, 0);
                }
                else if (ua.includes(token)) {
                    best = Math.max(best, token.length);
                }
            }
        }
        if (best === -1) {
            return [];
        }
        return groups.filter((group) => group.userAgents.some((token) => (token === '*' ? 0 : ua.includes(token) ? token.length : -1) === best));
    };
    return {
        sitemaps,
        isAllowed(url, userAgent) {
            const applicable = matchGroups(userAgent);
            if (applicable.length === 0) {
                return true;
            }
            const path = pathOf(url);
            let verdict = true;
            let bestLength = -1;
            for (const group of applicable) {
                for (const rule of group.rules) {
                    if (!rule.regex.test(path)) {
                        continue;
                    }
                    const length = rule.pattern.length;
                    if (length > bestLength) {
                        bestLength = length;
                        verdict = rule.allow;
                    }
                    else if (length === bestLength && rule.allow) {
                        verdict = true; // Allow wins ties
                    }
                }
            }
            return verdict;
        },
        crawlDelayMs(userAgent) {
            for (const group of matchGroups(userAgent)) {
                if (group.crawlDelayMs !== null) {
                    return group.crawlDelayMs;
                }
            }
            return null;
        },
    };
}
//# sourceMappingURL=robots.js.map