/**
 * Authentication has been removed from this build: there is no login, no JWT and
 * no per-project RBAC — every endpoint is open. A single seeded "system" user is
 * used as the actor for created_by / audit fields so referential integrity and
 * the audit trail still hold. A basic per-IP rate limiter remains.
 */
export declare class AppModule {
}
