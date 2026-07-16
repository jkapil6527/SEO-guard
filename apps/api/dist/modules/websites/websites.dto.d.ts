export declare class CreateWebsiteDto {
    name: string;
    origin: string;
    pathScope?: string;
    settings?: Record<string, unknown>;
}
export declare class UpdateWebsiteDto {
    name?: string;
    settings?: Record<string, unknown>;
    isActive?: boolean;
}
/**
 * Normalizes an origin: http(s) only, no credentials/path/query/fragment,
 * lowercased host, default ports stripped.
 */
export declare function normalizeOrigin(raw: string): string;
