"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = exports.RequireProjectRole = exports.SuperAdminOnly = exports.Public = void 0;
const common_1 = require("@nestjs/common");
const auth_user_1 = require("./auth-user");
const Public = () => (0, common_1.SetMetadata)('isPublic', true);
exports.Public = Public;
const SuperAdminOnly = () => (0, common_1.SetMetadata)('superAdminOnly', true);
exports.SuperAdminOnly = SuperAdminOnly;
const RequireProjectRole = (role, entity, param) => (0, common_1.SetMetadata)('projectRole', { role, entity, param });
exports.RequireProjectRole = RequireProjectRole;
/** Always resolves to the fixed system actor (auth removed). */
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, _ctx) => auth_user_1.SYSTEM_USER);
//# sourceMappingURL=decorators.js.map