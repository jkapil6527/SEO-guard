import type { EntityValidation, ProfilePack, SchemaEntity, VocabPack } from './types';
/**
 * Validates a single entity (and its nested entities) against the vocabulary
 * pack, and derives required/recommended coverage from the rich-result profiles
 * that apply to the entity's type. Pure.
 */
export declare function validateEntity(entity: SchemaEntity, vocab: VocabPack, profiles: ProfilePack, isRoot?: boolean): EntityValidation;
