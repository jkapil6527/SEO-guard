/** Link Technical-SEO checks. */
import { IssueSeverity } from '@seo-guardian/shared';
import type { CheckDefinition } from '../types';
import { createCheck, passed } from './factory';
import type { PartialResult } from './factory';

/**
 * Redirect chains longer than this many hops are flagged. Lives here (a leaf
 * module) rather than in the catalog, which imports the checks — the reverse
 * edge would close an import cycle.
 */
export const MAX_REDIRECT_HOPS = 2;

const GENERIC_ANCHORS = new Set([
  'click here',
  'click',
  'here',
  'read more',
  'read',
  'more',
  'learn more',
  'link',
  'this',
  'this page',
  'go',
]);

export const linkChecks: CheckDefinition[] = [
  createCheck({
    id: 'links.internal.broken',
    name: 'Broken internal link',
    category: 'links',
    defaultSeverity: IssueSeverity.Critical,
    weight: 20,
    description: 'One or more internal links point to a URL that returns an error.',
    technicalExplanation:
      'Broken internal links waste crawl budget, strand PageRank, and send users to dead ends. Internal 404s are entirely within the site owner control.',
    suggestedFix:
      'Update or remove links that target error pages; add redirects for moved content.',
    evaluate(a, site) {
      if (site.linkStatuses === undefined) {
        return [{ status: 'not_applicable', message: 'Link verification data unavailable.' }];
      }
      const statuses = site.linkStatuses;
      const broken: PartialResult[] = [];
      for (const link of a.links) {
        if (!link.internal) {
          continue;
        }
        const status = statuses.get(link.href);
        if (status !== undefined && !status.ok) {
          broken.push({
            status: 'fail',
            message: `Internal link is broken (HTTP ${status.status ?? 'error'}): ${link.href}`,
            affectedElement: link.href,
            metadata: {
              httpStatus: status.status,
              anchorText: link.text,
              selector: link.selector,
              snippet: link.snippet,
            },
          });
        }
      }
      return broken.length > 0 ? broken : passed('All checked internal links resolve.');
    },
  }),
  createCheck({
    id: 'links.external.broken',
    name: 'Broken external link',
    category: 'links',
    defaultSeverity: IssueSeverity.Medium,
    weight: 8,
    description: 'One or more external links point to a URL that returns an error.',
    technicalExplanation:
      'Broken outbound links harm user trust and content quality signals, even though the target is outside the site owner control.',
    suggestedFix: 'Update or remove external links that no longer resolve.',
    evaluate(a, site) {
      if (site.linkStatuses === undefined) {
        return [{ status: 'not_applicable', message: 'Link verification data unavailable.' }];
      }
      const statuses = site.linkStatuses;
      const broken: PartialResult[] = [];
      for (const link of a.links) {
        if (link.internal) {
          continue;
        }
        const status = statuses.get(link.href);
        if (status !== undefined && !status.ok) {
          broken.push({
            status: 'fail',
            message: `External link is broken (HTTP ${status.status ?? 'error'}): ${link.href}`,
            affectedElement: link.href,
            metadata: {
              httpStatus: status.status,
              anchorText: link.text,
              selector: link.selector,
              snippet: link.snippet,
            },
          });
        }
      }
      return broken.length > 0 ? broken : passed('All checked external links resolve.');
    },
  }),
  createCheck({
    id: 'links.redirect.chain_too_long',
    name: 'Link redirect chain too long',
    category: 'links',
    defaultSeverity: IssueSeverity.High,
    weight: 10,
    description: `One or more links pass through more than ${MAX_REDIRECT_HOPS} redirect hops.`,
    technicalExplanation:
      'Long redirect chains slow page loads, dilute link equity at each hop, and risk exceeding crawler redirect limits, leaving the final target unindexed.',
    suggestedFix: 'Point links directly at the final destination URL to collapse the chain.',
    evaluate(a, site) {
      if (site.linkStatuses === undefined) {
        return [{ status: 'not_applicable', message: 'Link verification data unavailable.' }];
      }
      const statuses = site.linkStatuses;
      const long: PartialResult[] = [];
      for (const link of a.links) {
        const status = statuses.get(link.href);
        if (status !== undefined && status.redirectHops > MAX_REDIRECT_HOPS) {
          long.push({
            status: 'fail',
            message: `Link redirects through ${status.redirectHops} hops: ${link.href}`,
            affectedElement: link.href,
            metadata: {
              redirectHops: status.redirectHops,
              max: MAX_REDIRECT_HOPS,
              anchorText: link.text,
              selector: link.selector,
              snippet: link.snippet,
            },
          });
        }
      }
      return long.length > 0 ? long : passed('No link exceeds the redirect-hop limit.');
    },
  }),
  createCheck({
    id: 'links.rel.noopener_missing_on_blank',
    name: 'target="_blank" without rel="noopener"',
    category: 'links',
    defaultSeverity: IssueSeverity.Low,
    weight: 4,
    description: 'A link opens in a new tab without rel="noopener" or rel="noreferrer".',
    technicalExplanation:
      'A target="_blank" link without noopener lets the opened page access window.opener and navigate the original tab (reverse tabnabbing), a security and UX risk.',
    suggestedFix: 'Add rel="noopener" (or "noreferrer") to links that use target="_blank".',
    evaluate(a) {
      const offenders = a.links.filter((link) => {
        if (!link.targetBlank) {
          return false;
        }
        const rel = (link.rel ?? '').toLowerCase();
        return !rel.includes('noopener') && !rel.includes('noreferrer');
      });
      if (offenders.length > 0) {
        return offenders.map<PartialResult>((link) => ({
          status: 'warning',
          message: `target="_blank" without noopener: ${link.href}`,
          affectedElement: link.href,
          metadata: { selector: link.selector, snippet: link.snippet, anchorText: link.text },
        }));
      }
      return passed('All new-tab links use noopener/noreferrer.');
    },
  }),
  createCheck({
    id: 'links.anchor.empty_or_generic',
    name: 'Empty or generic anchor text',
    category: 'links',
    defaultSeverity: IssueSeverity.Low,
    weight: 3,
    description: 'One or more links use empty or non-descriptive anchor text.',
    technicalExplanation:
      'Anchor text is a relevance signal for the target page and a navigation aid for screen readers. Empty or generic anchors ("click here") convey no context.',
    suggestedFix: 'Use descriptive anchor text that summarizes the linked destination.',
    evaluate(a) {
      const offenders = a.links.filter((link) => {
        const normalized = link.text.trim().toLowerCase();
        return normalized.length === 0 || GENERIC_ANCHORS.has(normalized);
      });
      if (offenders.length > 0) {
        return offenders.map<PartialResult>((link) => ({
          status: 'warning',
          message:
            link.text.trim().length === 0
              ? `Link has empty anchor text: ${link.href}`
              : `Generic anchor text "${link.text.trim()}": ${link.href}`,
          affectedElement: link.href,
          metadata: { selector: link.selector, snippet: link.snippet, anchorText: link.text },
        }));
      }
      return passed('All links use descriptive anchor text.');
    },
  }),
];
