import type {
  ProfilePack,
  RichResultStatus,
  RichResultVerdict,
  SchemaEntity,
  SchemaOptions,
  SchemaValue,
} from './types';

/**
 * Evaluates Google rich-result eligibility for an entity against every profile
 * that applies to its type(s). Eligibility is driven by required-property
 * presence; missing recommended properties downgrade an eligible result to
 * "eligible with warnings". Pure.
 */
export function evaluateRichResults(
  entity: SchemaEntity,
  profiles: ProfilePack,
  options?: SchemaOptions,
): RichResultVerdict[] {
  const verdicts: RichResultVerdict[] = [];
  for (const profile of profiles.profiles) {
    if (options?.disabledProfiles?.has(profile.name)) continue;
    if (!profile.appliesTo.some((t) => entity.types.includes(t))) continue;

    const missingRequired: string[] = [];
    const missingRecommended: string[] = [];
    for (const rule of profile.properties) {
      if (hasProperty(entity, rule.name)) continue;
      if (rule.requirement === 'required') missingRequired.push(rule.name);
      else missingRecommended.push(rule.name);
    }

    const eligible = missingRequired.length === 0;
    const status: RichResultStatus = !eligible
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

function hasProperty(entity: SchemaEntity, prop: string): boolean {
  const v: SchemaValue | undefined = entity.properties[prop];
  if (v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}
