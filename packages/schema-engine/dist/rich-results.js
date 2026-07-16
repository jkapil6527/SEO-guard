"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRichResults = evaluateRichResults;
/**
 * Evaluates Google rich-result eligibility for an entity against every profile
 * that applies to its type(s). Eligibility is driven by required-property
 * presence; missing recommended properties downgrade an eligible result to
 * "eligible with warnings". Pure.
 */
function evaluateRichResults(entity, profiles, options) {
    const verdicts = [];
    for (const profile of profiles.profiles) {
        if (options?.disabledProfiles?.has(profile.name))
            continue;
        if (!profile.appliesTo.some((t) => entity.types.includes(t)))
            continue;
        const missingRequired = [];
        const missingRecommended = [];
        for (const rule of profile.properties) {
            if (hasProperty(entity, rule.name))
                continue;
            if (rule.requirement === 'required')
                missingRequired.push(rule.name);
            else
                missingRecommended.push(rule.name);
        }
        const eligible = missingRequired.length === 0;
        const status = !eligible
            ? 'ineligible'
            : missingRecommended.length > 0
                ? 'eligible_with_warnings'
                : 'eligible';
        const errors = missingRequired.map((p) => `Missing required property "${p}".`);
        const warnings = missingRecommended.map((p) => `Missing recommended property "${p}".`);
        verdicts.push({
            profile: profile.name,
            eligible,
            status,
            missingRequired,
            missingRecommended,
            errors,
            warnings,
            reason: eligible
                ? missingRecommended.length > 0
                    ? `Eligible for ${profile.name} rich results, but ${missingRecommended.length} recommended propert${missingRecommended.length === 1 ? 'y is' : 'ies are'} missing.`
                    : `Eligible for ${profile.name} rich results — all required and recommended properties are present.`
                : `Not eligible for ${profile.name} rich results: missing ${missingRequired.join(', ')}.`,
        });
    }
    return verdicts;
}
function hasProperty(entity, prop) {
    const v = entity.properties[prop];
    if (v === undefined)
        return false;
    if (typeof v === 'string')
        return v.trim() !== '';
    if (Array.isArray(v))
        return v.length > 0;
    return true;
}
//# sourceMappingURL=rich-results.js.map