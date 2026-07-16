"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envFilePaths = envFilePaths;
const node_path_1 = require("node:path");
/**
 * Candidate .env locations, most specific first. Apps run from their own package
 * directory (e.g. via `pnpm --filter … dev` or turbo), while the canonical .env
 * lives at the monorepo root — so we look in both the current working directory
 * and the repo root (three levels up from the compiled apps/api/dist).
 */
function envFilePaths() {
    return [
        (0, node_path_1.resolve)(process.cwd(), '.env'),
        (0, node_path_1.resolve)(__dirname, '../../../.env'),
        (0, node_path_1.resolve)(__dirname, '../../../../.env'),
    ];
}
//# sourceMappingURL=env-files.js.map