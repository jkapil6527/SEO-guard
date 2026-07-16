"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_PROJECT_ROLES = void 0;
exports.roleSatisfies = roleSatisfies;
const enums_1 = require("./enums");
/**
 * Role hierarchy for project-scoped authorization. A required role is satisfied
 * by any role with an equal or higher rank. Super admins bypass this entirely.
 */
const ROLE_RANK = {
    [enums_1.ProjectRole.Admin]: 40,
    [enums_1.ProjectRole.SeoManager]: 30,
    [enums_1.ProjectRole.Developer]: 20,
    [enums_1.ProjectRole.Viewer]: 10,
};
function roleSatisfies(actual, required) {
    return ROLE_RANK[actual] >= ROLE_RANK[required];
}
exports.ALL_PROJECT_ROLES = [
    enums_1.ProjectRole.Admin,
    enums_1.ProjectRole.SeoManager,
    enums_1.ProjectRole.Developer,
    enums_1.ProjectRole.Viewer,
];
//# sourceMappingURL=roles.js.map