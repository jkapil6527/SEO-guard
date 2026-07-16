"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCrawlConfig = resolveCrawlConfig;
exports.serializeConfig = serializeConfig;
exports.deserializeConfig = deserializeConfig;
function resolveCrawlConfig(websiteSettings, defaults) {
    const s = websiteSettings;
    return {
        userAgent: s.userAgent ?? defaults.userAgent,
        renderPolicy: s.renderPolicy ?? 'auto',
        ratePerSec: clampNumber(s.ratePerSec, defaults.ratePerSec, 0.1, 50),
        domainConcurrency: clampNumber(s.domainConcurrency, defaults.domainConcurrency, 1, 16),
        maxRedirects: 5,
        timeoutMs: 15_000,
        respectRobots: s.respectRobots ?? true,
        discoveryMaxDepth: 3,
        discoveryMaxPages: 10_000,
        allow: Array.isArray(s.allow) ? s.allow : [],
        block: Array.isArray(s.block) ? s.block : [],
    };
}
/** Serialize for Redis HSET (all string values). */
function serializeConfig(config) {
    return {
        userAgent: config.userAgent,
        renderPolicy: config.renderPolicy,
        ratePerSec: String(config.ratePerSec),
        domainConcurrency: String(config.domainConcurrency),
        maxRedirects: String(config.maxRedirects),
        timeoutMs: String(config.timeoutMs),
        respectRobots: config.respectRobots ? '1' : '0',
        discoveryMaxDepth: String(config.discoveryMaxDepth),
        discoveryMaxPages: String(config.discoveryMaxPages),
        allow: JSON.stringify(config.allow),
        block: JSON.stringify(config.block),
    };
}
function deserializeConfig(raw, fallback) {
    if (!raw.userAgent)
        return fallback;
    return {
        userAgent: raw.userAgent,
        renderPolicy: raw.renderPolicy ?? 'auto',
        ratePerSec: Number(raw.ratePerSec ?? fallback.ratePerSec),
        domainConcurrency: Number(raw.domainConcurrency ?? fallback.domainConcurrency),
        maxRedirects: Number(raw.maxRedirects ?? 5),
        timeoutMs: Number(raw.timeoutMs ?? 15_000),
        respectRobots: raw.respectRobots !== '0',
        discoveryMaxDepth: Number(raw.discoveryMaxDepth ?? 3),
        discoveryMaxPages: Number(raw.discoveryMaxPages ?? 10_000),
        allow: safeParseArray(raw.allow),
        block: safeParseArray(raw.block),
    };
}
function clampNumber(value, fallback, min, max) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, n));
}
function safeParseArray(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=crawl-config.js.map