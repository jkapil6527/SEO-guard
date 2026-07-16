/** Image Technical-SEO checks. */
import { IssueSeverity } from '@seo-guardian/shared';
import type { CheckDefinition } from '../types';
import { createCheck, passed } from './factory';
import type { PartialResult } from './factory';

export const imageChecks: CheckDefinition[] = [
  createCheck({
    id: 'images.alt.missing',
    name: 'Image missing alt attribute',
    category: 'images',
    defaultSeverity: IssueSeverity.High,
    weight: 12,
    description: 'One or more images have no alt attribute.',
    technicalExplanation:
      'Images without an alt attribute are invisible to screen readers and give search engines no textual context, forfeiting image-search relevance and accessibility.',
    suggestedFix:
      'Add a descriptive alt attribute to each content image (alt="" only for decorative images).',
    evaluate(a) {
      const missing = a.images.filter((img) => img.alt === null);
      if (missing.length > 0) {
        return missing.map<PartialResult>((img) => ({
          status: 'fail',
          message: `Image has no alt attribute: ${img.src}`,
          affectedElement: img.src,
          metadata: { selector: img.selector, snippet: img.snippet },
        }));
      }
      return passed('All images have an alt attribute.');
    },
  }),
  createCheck({
    id: 'images.alt.empty_on_meaningful',
    name: 'Image has empty alt text',
    category: 'images',
    defaultSeverity: IssueSeverity.Medium,
    weight: 6,
    description: 'One or more images declare an empty alt attribute.',
    technicalExplanation:
      'alt="" marks an image as decorative and hides it from assistive tech. When applied to a meaningful image it hides real content from screen readers and search engines.',
    suggestedFix:
      'Provide descriptive alt text for meaningful images; keep alt="" only for purely decorative ones.',
    evaluate(a) {
      const empty = a.images.filter((img) => img.alt !== null && img.alt.trim().length === 0);
      if (empty.length > 0) {
        return empty.map<PartialResult>((img) => ({
          status: 'warning',
          message: `Image declares empty alt text: ${img.src}`,
          affectedElement: img.src,
          metadata: { selector: img.selector, snippet: img.snippet },
        }));
      }
      return passed('No images declare empty alt text.');
    },
  }),
  createCheck({
    id: 'images.dimensions.missing_width',
    name: 'Image missing width attribute',
    category: 'images',
    defaultSeverity: IssueSeverity.Low,
    weight: 3,
    description: 'One or more images have no width attribute.',
    technicalExplanation:
      'Explicit width lets the browser reserve layout space before the image loads, preventing cumulative layout shift (CLS), a Core Web Vitals factor.',
    suggestedFix: 'Add an explicit width attribute to each image.',
    evaluate(a) {
      const missing = a.images.filter((img) => img.width === null);
      if (missing.length > 0) {
        return missing.map<PartialResult>((img) => ({
          status: 'warning',
          message: `Image has no width attribute: ${img.src}`,
          affectedElement: img.src,
          metadata: { selector: img.selector, snippet: img.snippet },
        }));
      }
      return passed('All images declare a width.');
    },
  }),
  createCheck({
    id: 'images.dimensions.missing_height',
    name: 'Image missing height attribute',
    category: 'images',
    defaultSeverity: IssueSeverity.Low,
    weight: 3,
    description: 'One or more images have no height attribute.',
    technicalExplanation:
      'Explicit height lets the browser reserve layout space before the image loads, preventing cumulative layout shift (CLS), a Core Web Vitals factor.',
    suggestedFix: 'Add an explicit height attribute to each image.',
    evaluate(a) {
      const missing = a.images.filter((img) => img.height === null);
      if (missing.length > 0) {
        return missing.map<PartialResult>((img) => ({
          status: 'warning',
          message: `Image has no height attribute: ${img.src}`,
          affectedElement: img.src,
          metadata: { selector: img.selector, snippet: img.snippet },
        }));
      }
      return passed('All images declare a height.');
    },
  }),
  createCheck({
    id: 'images.src.broken',
    name: 'Image source is broken',
    category: 'images',
    defaultSeverity: IssueSeverity.High,
    weight: 12,
    description: 'One or more image sources return an error status.',
    technicalExplanation:
      'A broken image source degrades the user experience and signals poor maintenance; broken media can also affect image-search indexing.',
    suggestedFix: 'Fix or replace the image URL so it returns a 2xx response.',
    evaluate(a, site) {
      if (site.linkStatuses === undefined) {
        return [
          {
            status: 'not_applicable',
            message: 'Link verification data unavailable; image sources not checked.',
          },
        ];
      }
      const statuses = site.linkStatuses;
      const broken: PartialResult[] = [];
      for (const img of a.images) {
        if (img.src.length === 0) {
          continue;
        }
        const status = statuses.get(img.src);
        if (status !== undefined && !status.ok) {
          broken.push({
            status: 'fail',
            message: `Image source is broken (HTTP ${status.status ?? 'error'}): ${img.src}`,
            affectedElement: img.src,
            metadata: {
              httpStatus: status.status,
              selector: img.selector,
              snippet: img.snippet,
            },
          });
        }
      }
      if (broken.length > 0) {
        return broken;
      }
      return passed('All checked image sources resolve successfully.');
    },
  }),
];
