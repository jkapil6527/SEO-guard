/** Stable machine-readable error codes surfaced in ProblemDetails.code. */
export declare const ERROR_CODES: {
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly TOKEN_REUSED: "TOKEN_REUSED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly CONFLICT: "CONFLICT";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly INVALID_CRON: "INVALID_CRON";
    readonly INVALID_TIMEZONE: "INVALID_TIMEZONE";
    readonly CSV_INVALID: "CSV_INVALID";
    readonly INTERNAL: "INTERNAL";
};
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
