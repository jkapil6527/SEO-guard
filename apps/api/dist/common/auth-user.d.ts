export interface AuthUser {
    id: string;
    email: string;
    isSuperAdmin: boolean;
}
/**
 * Fixed "system" actor used for every request now that authentication is
 * removed. Its id matches a seeded users row (see ensureSystemUser) so
 * created_by / audit foreign keys remain valid.
 */
export declare const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
export declare const SYSTEM_USER: AuthUser;
