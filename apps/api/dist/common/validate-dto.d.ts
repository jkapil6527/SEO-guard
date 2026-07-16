import type { ClassConstructor } from 'class-transformer';
/**
 * Manual DTO validation for endpoints whose body shape is discriminated at
 * runtime (e.g. url-source creation). Mirrors the global pipe's error format.
 */
export declare function validateDto<T extends object>(cls: ClassConstructor<T>, payload: unknown): Promise<T>;
