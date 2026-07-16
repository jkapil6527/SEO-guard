"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envFilePaths = envFilePaths;
const node_path_1 = require("node:path");
/**
 * Candidate .env locations, most specific first. The worker runs from its own
 * package directory while the canonical .env lives at the monorepo root, so we
 * look in both the current working directory and the repo root.
 */
function envFilePaths() {
    return [
        (0, node_path_1.resolve)(process.cwd(), '.env'),
        (0, node_path_1.resolve)(__dirname, '../../../.env'),
        (0, node_path_1.resolve)(__dirname, '../../../../.env'),
    ];
}
//# sourceMappingURL=env-files.js.map