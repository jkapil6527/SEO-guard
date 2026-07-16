/**
 * robots.txt parser following the Google-style Robots Exclusion Protocol
 * (RFC 9309 with Google extensions: wildcards, `$` anchor, Crawl-delay).
 */
import type { RobotsRules } from './types';
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
export declare function parseRobots(txt: string): RobotsRules;
