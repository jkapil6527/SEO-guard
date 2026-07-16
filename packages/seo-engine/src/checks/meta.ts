/** Meta / head-level Technical-SEO checks. */
import { IssueSeverity } from '@seo-guardian/shared';
import type { CheckDefinition } from '../types';
import { isValidBcp47, robotsTokens, urlRegistrableDomain } from '../util';
import { createCheck, passed } from './factory';
import type { PartialResult } from './factory';

const TITLE_MAX = 60;
const TITLE_MIN = 10;
const DESCRIPTION_MAX = 160;
const DESCRIPTION_MIN = 50;

export const metaChecks: CheckDefinition[] = [
  createCheck({
    id: 'meta.title.missing',
    name: 'Title tag missing',
    category: 'meta',
    defaultSeverity: IssueSeverity.Critical,
    weight: 25,
    description: 'The page has no <title> element in the document head.',
    technicalExplanation:
      'The <title> is the strongest on-page relevance signal and the clickable headline in search results. A page with no title element cannot communicate its topic to search engines.',
    suggestedFix: 'Add a unique, descriptive <title> element inside <head>.',
    evaluate(a) {
      if (a.title === null) {
        return [{ status: 'fail', message: 'No <title> element found in the document.' }];
      }
      return passed('Title tag is present.');
    },
  }),
  createCheck({
    id: 'meta.title.empty',
    name: 'Title tag empty',
    category: 'meta',
    defaultSeverity: IssueSeverity.Critical,
    weight: 25,
    description: 'A <title> element exists but contains no text.',
    technicalExplanation:
      'An empty title is equivalent to a missing one for ranking and SERP display; search engines fall back to guessing a title from page content.',
    suggestedFix: 'Populate the <title> element with descriptive text.',
    evaluate(a) {
      if (a.title !== null && a.title.length === 0) {
        return [{ status: 'fail', message: 'The <title> element is empty.' }];
      }
      return passed('Title tag has content.');
    },
  }),
  createCheck({
    id: 'meta.title.too_long',
    name: 'Title tag too long',
    category: 'meta',
    defaultSeverity: IssueSeverity.Medium,
    weight: 8,
    description: `The title exceeds ${TITLE_MAX} characters and may be truncated in search results.`,
    technicalExplanation:
      'Google truncates titles at roughly 600px (~60 characters). Overlong titles lose their tail keywords and calls-to-action in the SERP.',
    suggestedFix: `Shorten the title to ${TITLE_MAX} characters or fewer, front-loading the primary keyword.`,
    evaluate(a) {
      if (a.title !== null && a.title.length > TITLE_MAX) {
        return [
          {
            status: 'fail',
            message: `Title is ${a.title.length} characters (max ${TITLE_MAX}).`,
            metadata: { length: a.title.length, max: TITLE_MAX },
          },
        ];
      }
      return passed('Title length is within range.');
    },
  }),
  createCheck({
    id: 'meta.title.too_short',
    name: 'Title tag too short',
    category: 'meta',
    defaultSeverity: IssueSeverity.Low,
    weight: 5,
    description: `The title is shorter than ${TITLE_MIN} characters.`,
    technicalExplanation:
      'Very short titles rarely contain enough context or keywords to compete for relevant queries and waste available SERP real estate.',
    suggestedFix: `Expand the title to at least ${TITLE_MIN} characters with descriptive, keyword-rich text.`,
    evaluate(a) {
      if (a.title !== null && a.title.length > 0 && a.title.length < TITLE_MIN) {
        return [
          {
            status: 'warning',
            message: `Title is ${a.title.length} characters (min ${TITLE_MIN}).`,
            metadata: { length: a.title.length, min: TITLE_MIN },
          },
        ];
      }
      return passed('Title length is within range.');
    },
  }),
  createCheck({
    id: 'meta.description.missing',
    name: 'Meta description missing',
    category: 'meta',
    defaultSeverity: IssueSeverity.High,
    weight: 15,
    description: 'The page has no meta description.',
    technicalExplanation:
      'The meta description is the primary source for the SERP snippet. Without it, search engines auto-generate a snippet from page text, which is often less compelling and reduces click-through rate.',
    suggestedFix: 'Add a <meta name="description"> with a unique 50-160 character summary.',
    evaluate(a) {
      if (a.metaDescription === null || a.metaDescription.length === 0) {
        return [{ status: 'fail', message: 'No meta description found.' }];
      }
      return passed('Meta description is present.');
    },
  }),
  createCheck({
    id: 'meta.description.too_long',
    name: 'Meta description too long',
    category: 'meta',
    defaultSeverity: IssueSeverity.Low,
    weight: 5,
    description: `The meta description exceeds ${DESCRIPTION_MAX} characters.`,
    technicalExplanation:
      'Descriptions beyond ~160 characters are truncated with an ellipsis in the SERP, cutting off information and any call to action.',
    suggestedFix: `Trim the meta description to ${DESCRIPTION_MAX} characters or fewer.`,
    evaluate(a) {
      if (a.metaDescription !== null && a.metaDescription.length > DESCRIPTION_MAX) {
        return [
          {
            status: 'warning',
            message: `Meta description is ${a.metaDescription.length} characters (max ${DESCRIPTION_MAX}).`,
            metadata: { length: a.metaDescription.length, max: DESCRIPTION_MAX },
          },
        ];
      }
      return passed('Meta description length is within range.');
    },
  }),
  createCheck({
    id: 'meta.description.too_short',
    name: 'Meta description too short',
    category: 'meta',
    defaultSeverity: IssueSeverity.Low,
    weight: 5,
    description: `The meta description is shorter than ${DESCRIPTION_MIN} characters.`,
    technicalExplanation:
      'Short descriptions under-utilize the snippet space and often fail to summarize the page or entice a click.',
    suggestedFix: `Expand the meta description to at least ${DESCRIPTION_MIN} characters.`,
    evaluate(a) {
      if (
        a.metaDescription !== null &&
        a.metaDescription.length > 0 &&
        a.metaDescription.length < DESCRIPTION_MIN
      ) {
        return [
          {
            status: 'warning',
            message: `Meta description is ${a.metaDescription.length} characters (min ${DESCRIPTION_MIN}).`,
            metadata: { length: a.metaDescription.length, min: DESCRIPTION_MIN },
          },
        ];
      }
      return passed('Meta description length is within range.');
    },
  }),
  createCheck({
    id: 'meta.canonical.missing',
    name: 'Canonical link missing',
    category: 'meta',
    defaultSeverity: IssueSeverity.High,
    weight: 15,
    description: 'The page declares no rel="canonical" link.',
    technicalExplanation:
      'Without a canonical, search engines may index duplicate or parameterized variants of the URL separately, splitting ranking signals.',
    suggestedFix: 'Add <link rel="canonical" href="..."> pointing to the preferred absolute URL.',
    evaluate(a) {
      if (a.canonicals.length === 0) {
        return [{ status: 'fail', message: 'No rel="canonical" link found.' }];
      }
      return passed('Canonical link is present.');
    },
  }),
  createCheck({
    id: 'meta.canonical.multiple',
    name: 'Multiple canonical links',
    category: 'meta',
    defaultSeverity: IssueSeverity.Critical,
    weight: 20,
    description: 'The page declares more than one rel="canonical" link.',
    technicalExplanation:
      'Conflicting canonical tags are ambiguous; Google typically ignores all of them, forfeiting canonicalization control entirely.',
    suggestedFix: 'Keep exactly one rel="canonical" link and remove the others.',
    evaluate(a) {
      if (a.canonicals.length > 1) {
        return [
          {
            status: 'fail',
            message: `${a.canonicals.length} canonical links found; expected exactly one.`,
            metadata: { canonicals: a.canonicals },
          },
        ];
      }
      return passed('At most one canonical link is present.');
    },
  }),
  createCheck({
    id: 'meta.canonical.non_https',
    name: 'Canonical uses HTTP',
    category: 'meta',
    defaultSeverity: IssueSeverity.Medium,
    weight: 10,
    description: 'A canonical link targets an insecure http:// URL.',
    technicalExplanation:
      'Pointing the canonical at an http:// URL can cause search engines to prefer the insecure variant for indexing, undermining an HTTPS migration.',
    suggestedFix: 'Update the canonical URL to use https://.',
    evaluate(a) {
      const insecure = a.canonicals.filter((c) => c.startsWith('http://'));
      if (insecure.length > 0) {
        return insecure.map<PartialResult>((c) => ({
          status: 'fail',
          message: `Canonical points to an insecure URL: ${c}`,
          affectedElement: c,
        }));
      }
      return passed('Canonical URLs use HTTPS.');
    },
  }),
  createCheck({
    id: 'meta.canonical.cross_domain',
    name: 'Canonical points to another domain',
    category: 'meta',
    defaultSeverity: IssueSeverity.Medium,
    weight: 10,
    description: 'A canonical link targets a different registrable domain than the page.',
    technicalExplanation:
      'A cross-domain canonical instructs search engines to attribute this page to another site, which — if unintentional — deindexes the page in favor of the external URL.',
    suggestedFix:
      'Point the canonical at a URL on the same domain unless cross-domain consolidation is intended.',
    evaluate(a) {
      const pageDomain = urlRegistrableDomain(a.finalUrl);
      if (pageDomain === null) {
        return passed('Page domain could not be determined; check skipped.');
      }
      const crossDomain = a.canonicals.filter((c) => {
        const domain = urlRegistrableDomain(c);
        return domain !== null && domain !== pageDomain;
      });
      if (crossDomain.length > 0) {
        return crossDomain.map<PartialResult>((c) => ({
          status: 'fail',
          message: `Canonical points to another domain: ${c}`,
          affectedElement: c,
        }));
      }
      return passed('Canonical URLs are same-domain.');
    },
  }),
  createCheck({
    id: 'meta.robots.noindex',
    name: 'Page set to noindex',
    category: 'meta',
    defaultSeverity: IssueSeverity.Critical,
    weight: 30,
    description: 'A robots directive instructs search engines not to index this page.',
    technicalExplanation:
      'A noindex directive (via meta robots or the X-Robots-Tag header) removes the page from search indexes entirely. This is critical when unintended.',
    suggestedFix: 'Remove the noindex directive if the page should be indexable.',
    evaluate(a) {
      if (a.robotsMeta.noindex || a.robotsMeta.headerNoindex) {
        const source = a.robotsMeta.headerNoindex ? 'X-Robots-Tag header' : 'meta robots';
        return [
          {
            status: 'fail',
            message: `Page is marked noindex via ${source}.`,
            metadata: {
              metaRaw: a.robotsMeta.raw,
              headerRaw: a.robotsMeta.headerRaw,
            },
          },
        ];
      }
      return passed('Page is indexable.');
    },
  }),
  createCheck({
    id: 'meta.robots.nofollow',
    name: 'Page set to nofollow',
    category: 'meta',
    defaultSeverity: IssueSeverity.High,
    weight: 15,
    description: 'A meta robots directive marks all links on the page as nofollow.',
    technicalExplanation:
      'A page-level nofollow stops crawlers from following any outgoing link, which can strand internal pages and waste crawl equity.',
    suggestedFix: 'Remove the page-level nofollow directive unless intentional.',
    evaluate(a) {
      if (a.robotsMeta.nofollow) {
        return [
          {
            status: 'fail',
            message: 'Page is marked nofollow via meta robots.',
            metadata: { metaRaw: a.robotsMeta.raw },
          },
        ];
      }
      return passed('Page-level links are followable.');
    },
  }),
  createCheck({
    id: 'meta.robots.conflicting',
    name: 'Conflicting robots directives',
    category: 'meta',
    defaultSeverity: IssueSeverity.High,
    weight: 12,
    description: 'The robots directives contain contradictory instructions.',
    technicalExplanation:
      'Contradictory directives (e.g. both index and noindex, or a meta index conflicting with an X-Robots-Tag noindex) are resolved unpredictably; the most restrictive usually wins, risking accidental deindexing.',
    suggestedFix: 'Reconcile robots directives so meta and header agree on a single intent.',
    evaluate(a) {
      const tokens = robotsTokens(a.robotsMeta.raw);
      const hasIndex = tokens.includes('index');
      const hasNoindex = tokens.includes('noindex') || tokens.includes('none');
      const hasFollow = tokens.includes('follow');
      const hasNofollow = tokens.includes('nofollow') || tokens.includes('none');
      const selfConflict = (hasIndex && hasNoindex) || (hasFollow && hasNofollow);
      const headerConflict = hasIndex && a.robotsMeta.headerNoindex;
      if (selfConflict || headerConflict) {
        return [
          {
            status: 'fail',
            message: 'Robots directives contradict each other.',
            metadata: { metaRaw: a.robotsMeta.raw, headerRaw: a.robotsMeta.headerRaw },
          },
        ];
      }
      return passed('Robots directives are consistent.');
    },
  }),
  createCheck({
    id: 'meta.charset.missing',
    name: 'Character encoding not declared',
    category: 'meta',
    defaultSeverity: IssueSeverity.Medium,
    weight: 8,
    description: 'The document declares no character encoding.',
    technicalExplanation:
      'Without a declared charset the browser guesses the encoding, which can mangle multibyte characters and lets some XSS vectors through. Declare it early in <head>.',
    suggestedFix: 'Add <meta charset="utf-8"> as the first element in <head>.',
    evaluate(a) {
      if (a.charset === null) {
        return [{ status: 'fail', message: 'No character encoding declared.' }];
      }
      return passed(`Charset declared: ${a.charset}.`);
    },
  }),
  createCheck({
    id: 'meta.viewport.missing',
    name: 'Viewport meta missing',
    category: 'meta',
    defaultSeverity: IssueSeverity.High,
    weight: 15,
    description: 'The page has no viewport meta tag.',
    technicalExplanation:
      'Without a viewport meta, mobile browsers render at a desktop width and zoom out, failing Google mobile-friendliness and hurting mobile-first ranking.',
    suggestedFix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    evaluate(a) {
      if (a.viewport === null) {
        return [{ status: 'fail', message: 'No viewport meta tag found.' }];
      }
      return passed('Viewport meta tag is present.');
    },
  }),
  createCheck({
    id: 'meta.viewport.not_responsive',
    name: 'Viewport not responsive',
    category: 'meta',
    defaultSeverity: IssueSeverity.Medium,
    weight: 10,
    description: 'The viewport meta does not use width=device-width.',
    technicalExplanation:
      'A viewport without width=device-width (or one locking user-scalable/maximum-scale) prevents the layout from adapting to the device and blocks pinch-zoom, harming mobile usability.',
    suggestedFix: 'Set the viewport content to include width=device-width, initial-scale=1.',
    evaluate(a) {
      if (a.viewport === null) {
        return passed('No viewport present; handled by meta.viewport.missing.');
      }
      const value = a.viewport.toLowerCase();
      const responsive = /width\s*=\s*device-width/.test(value);
      const locked =
        /user-scalable\s*=\s*no/.test(value) || /maximum-scale\s*=\s*1(\.0)?\b/.test(value);
      if (!responsive || locked) {
        return [
          {
            status: 'fail',
            message: `Viewport is not responsive: "${a.viewport}".`,
            affectedElement: a.viewport,
          },
        ];
      }
      return passed('Viewport is responsive.');
    },
  }),
  createCheck({
    id: 'meta.lang.missing',
    name: 'HTML lang attribute missing',
    category: 'meta',
    defaultSeverity: IssueSeverity.Medium,
    weight: 8,
    description: 'The <html> element has no lang attribute.',
    technicalExplanation:
      'The lang attribute declares the page language for search engines, screen readers, and translation tools. Its absence weakens language targeting and accessibility.',
    suggestedFix: 'Add a lang attribute to <html>, e.g. <html lang="en">.',
    evaluate(a) {
      if (a.htmlLang === null) {
        return [{ status: 'fail', message: 'No lang attribute on <html>.' }];
      }
      return passed(`HTML lang declared: ${a.htmlLang}.`);
    },
  }),
  createCheck({
    id: 'meta.lang.invalid_bcp47',
    name: 'HTML lang is not valid BCP-47',
    category: 'meta',
    defaultSeverity: IssueSeverity.Medium,
    weight: 8,
    description: 'The <html> lang attribute is not a well-formed BCP-47 tag.',
    technicalExplanation:
      'Malformed language tags (e.g. "english" or "en_US") are ignored by user agents, negating language targeting and accessibility benefits.',
    suggestedFix: 'Use a valid BCP-47 tag such as "en", "en-US", or "zh-Hans-CN".',
    evaluate(a) {
      if (a.htmlLang !== null && !isValidBcp47(a.htmlLang)) {
        return [
          {
            status: 'fail',
            message: `HTML lang "${a.htmlLang}" is not a valid BCP-47 tag.`,
            affectedElement: a.htmlLang,
          },
        ];
      }
      return passed('HTML lang is a valid BCP-47 tag or absent.');
    },
  }),
];
