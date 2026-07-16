/**
 * Versioned Schema.org vocabulary pack. Curated for depth on the types the
 * platform cares about, with a full type hierarchy so property inheritance and
 * expected-type validation work. This is DATA: adding or updating a type is a
 * change here, never in the engine. Types absent from the pack are still handled
 * generically by the validator (structural checks + unknown-property warnings
 * against the Thing base).
 *
 * Expected-type tokens: Text, URL, Date, DateTime, Time, Number, Integer,
 * Boolean, or a schema.org type / enumeration short name.
 */
import type { VocabPack } from '../types';
export declare const VOCAB_PACK: VocabPack;
