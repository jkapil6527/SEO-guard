"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.headingChecks = void 0;
/** Heading structure Technical-SEO checks. */
const shared_1 = require("@seo-guardian/shared");
const factory_1 = require("./factory");
exports.headingChecks = [
    (0, factory_1.createCheck)({
        id: 'headings.h1.missing',
        name: 'H1 heading missing',
        category: 'headings',
        defaultSeverity: shared_1.IssueSeverity.High,
        weight: 15,
        description: 'The page has no H1 heading.',
        technicalExplanation: 'The H1 is the primary on-page topic signal after the title. A missing H1 leaves the main heading of the page undefined for both users and crawlers.',
        suggestedFix: 'Add a single descriptive <h1> that summarizes the page.',
        evaluate(a) {
            const count = a.headings.filter((h) => h.level === 1).length;
            if (count === 0) {
                return [{ status: 'fail', message: 'No H1 heading found on the page.' }];
            }
            return (0, factory_1.passed)('An H1 heading is present.');
        },
    }),
    (0, factory_1.createCheck)({
        id: 'headings.h1.multiple',
        name: 'Multiple H1 headings',
        category: 'headings',
        defaultSeverity: shared_1.IssueSeverity.Medium,
        weight: 8,
        description: 'The page contains more than one H1 heading.',
        technicalExplanation: 'Multiple H1s dilute the primary topic signal and can indicate an unclear content hierarchy, especially on pages that predate HTML5 sectioning conventions.',
        suggestedFix: 'Keep one H1 and demote the remaining headings to H2 or lower.',
        evaluate(a) {
            const h1s = a.headings.filter((h) => h.level === 1);
            if (h1s.length > 1) {
                return [
                    {
                        status: 'fail',
                        message: `${h1s.length} H1 headings found; expected one.`,
                        metadata: {
                            count: h1s.length,
                            texts: h1s.map((h) => h.text),
                            locations: h1s.map((h) => ({ selector: h.selector, snippet: h.snippet })),
                        },
                    },
                ];
            }
            return (0, factory_1.passed)('At most one H1 heading is present.');
        },
    }),
    (0, factory_1.createCheck)({
        id: 'headings.h1.duplicate_of_title',
        name: 'H1 duplicates the title tag',
        category: 'headings',
        defaultSeverity: shared_1.IssueSeverity.Info,
        weight: 3,
        description: 'The H1 text is identical to the title tag.',
        technicalExplanation: 'An H1 that exactly matches the title is a missed opportunity: the two elements can target complementary phrasings and keyword variants rather than repeating verbatim.',
        suggestedFix: 'Differentiate the H1 from the title to cover additional query variants.',
        evaluate(a) {
            if (a.h1Text !== null &&
                a.title !== null &&
                a.title.length > 0 &&
                a.h1Text.trim().toLowerCase() === a.title.trim().toLowerCase()) {
                return [
                    {
                        status: 'warning',
                        message: 'H1 text is identical to the title tag.',
                        affectedElement: a.h1Text,
                    },
                ];
            }
            return (0, factory_1.passed)('H1 and title differ or one is absent.');
        },
    }),
    (0, factory_1.createCheck)({
        id: 'headings.hierarchy.skipped_level',
        name: 'Heading level skipped',
        category: 'headings',
        defaultSeverity: shared_1.IssueSeverity.Low,
        weight: 4,
        description: 'A heading level was skipped in the document outline.',
        technicalExplanation: 'Jumping heading levels (e.g. H2 directly to H4) breaks the semantic outline that assistive technology and crawlers use to understand content structure.',
        suggestedFix: 'Use heading levels sequentially without skipping a level.',
        evaluate(a) {
            const results = [];
            let previous = null;
            for (const heading of a.headings) {
                if (previous !== null && heading.level - previous > 1) {
                    results.push({
                        status: 'warning',
                        message: `Heading jumps from H${previous} to H${heading.level}.`,
                        affectedElement: `h${heading.level}: ${heading.text}`,
                        metadata: {
                            from: previous,
                            to: heading.level,
                            selector: heading.selector,
                            snippet: heading.snippet,
                        },
                    });
                }
                previous = heading.level;
            }
            if (results.length > 0) {
                return results;
            }
            return (0, factory_1.passed)('Heading levels are sequential.');
        },
    }),
    (0, factory_1.createCheck)({
        id: 'headings.any.empty',
        name: 'Empty heading',
        category: 'headings',
        defaultSeverity: shared_1.IssueSeverity.Medium,
        weight: 6,
        description: 'One or more headings contain no text.',
        technicalExplanation: 'Empty headings add noise to the document outline without conveying any topic, confusing screen-reader navigation and outline-based crawlers.',
        suggestedFix: 'Remove empty headings or give them meaningful text.',
        evaluate(a) {
            const empties = a.headings.filter((h) => h.text.length === 0);
            if (empties.length > 0) {
                return empties.map((h) => ({
                    status: 'fail',
                    message: `Empty H${h.level} heading.`,
                    affectedElement: h.selector,
                    metadata: { selector: h.selector, snippet: h.snippet, level: h.level },
                }));
            }
            return (0, factory_1.passed)('All headings contain text.');
        },
    }),
];
//# sourceMappingURL=headings.js.map