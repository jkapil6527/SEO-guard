"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_USER = exports.SYSTEM_USER_ID = void 0;
/**
 * Fixed "system" actor used for every request now that authentication is
 * removed. Its id matches a seeded users row (see ensureSystemUser) so
 * created_by / audit foreign keys remain valid.
 */
exports.SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
exports.SYSTEM_USER = {
    id: exports.SYSTEM_USER_ID,
    email: 'system@local',
    isSuperAdmin: true,
};
//# sourceMappingURL=auth-user.js.map