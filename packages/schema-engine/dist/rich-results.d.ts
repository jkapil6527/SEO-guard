import type { ProfilePack, RichResultVerdict, SchemaEntity, SchemaOptions } from './types';
/**
 * Evaluates Google rich-result eligibility for an entity against every profile
 * that applies to its type(s). Eligibility is driven by required-property
 * presence; missing recommended properties downgrade an eligible result to
 * "eligible with warnings". Pure.
 */
export declare function evaluateRichResults(entity: SchemaEntity, profiles: ProfilePack, options?: SchemaOptions): RichResultVerdict[];
