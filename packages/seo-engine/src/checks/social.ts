/** Social sharing tag presence checks (Open Graph, Twitter Cards). */
import { IssueSeverity } from '@seo-guardian/shared';
import type { CheckDefinition } from '../types';
import { createCheck, passed } from './factory';

const REQUIRED_OG = ['og:title', 'og:type', 'og:image', 'og:url'];

export const socialChecks: CheckDefinition[] = [
  createCheck({
    id: 'social.og.missing_required',
    name: 'Open Graph required tags missing',
    category: 'social',
    defaultSeverity: IssueSeverity.Medium,
    weight: 6,
    description: 'One or more required Open Graph tags are missing.',
    technicalExplanation:
      'Open Graph tags (og:title, og:type, og:image, og:url) control how the page renders when shared on social platforms. Missing tags produce broken or blank link previews, reducing referral click-through.',
    suggestedFix: 'Add the required og:title, og:type, og:image, and og:url meta tags.',
    evaluate(a) {
      const present = Object.keys(a.ogTags);
      const hasAnyOg = present.length > 0;
      const missing = REQUIRED_OG.filter(
        (key) => !(key in a.ogTags) || a.ogTags[key] === undefined || a.ogTags[key] === '',
      );
      if (hasAnyOg && missing.length > 0) {
        return [
          {
            status: 'fail',
            message: `Missing required Open Graph tags: ${missing.join(', ')}.`,
            metadata: { missing, present },
          },
        ];
      }
      if (!hasAnyOg) {
        return [
          {
            status: 'fail',
            message:
              'No Open Graph tags found; required tags (og:title/type/image/url) are missing.',
            metadata: { missing: REQUIRED_OG, present },
          },
        ];
      }
      return passed('All required Open Graph tags are present.');
    },
  }),
  createCheck({
    id: 'social.twitter.missing_card',
    name: 'Twitter Card type missing',
    category: 'social',
    defaultSeverity: IssueSeverity.Low,
    weight: 3,
    description: 'The page declares no twitter:card meta tag.',
    technicalExplanation:
      'Without twitter:card, X/Twitter falls back to a plain link with no rich preview, lowering engagement on shared URLs.',
    suggestedFix: 'Add a twitter:card meta tag (e.g. "summary_large_image").',
    evaluate(a) {
      const card = a.twitterTags['twitter:card'];
      if (card === undefined || card === '') {
        return [{ status: 'warning', message: 'No twitter:card meta tag found.' }];
      }
      return passed('Twitter Card type is declared.');
    },
  }),
];
