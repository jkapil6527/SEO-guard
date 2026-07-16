"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENGINE_VERSION = exports.SEVERITY_MULTIPLIER = exports.computePageScore = exports.runChecks = exports.MAX_REDIRECT_HOPS = exports.getCatalogCheck = exports.CHECK_IDS = exports.CROSS_PAGE_CHECKS = exports.CATALOG_CHECKS = exports.getCheck = exports.CHECKS = exports.extractArtifacts = void 0;
__exportStar(require("./types"), exports);
var extract_1 = require("./extract");
Object.defineProperty(exports, "extractArtifacts", { enumerable: true, get: function () { return extract_1.extractArtifacts; } });
var checks_1 = require("./checks");
Object.defineProperty(exports, "CHECKS", { enumerable: true, get: function () { return checks_1.CHECKS; } });
Object.defineProperty(exports, "getCheck", { enumerable: true, get: function () { return checks_1.getCheck; } });
var catalog_1 = require("./catalog");
Object.defineProperty(exports, "CATALOG_CHECKS", { enumerable: true, get: function () { return catalog_1.CATALOG_CHECKS; } });
Object.defineProperty(exports, "CROSS_PAGE_CHECKS", { enumerable: true, get: function () { return catalog_1.CROSS_PAGE_CHECKS; } });
Object.defineProperty(exports, "CHECK_IDS", { enumerable: true, get: function () { return catalog_1.CHECK_IDS; } });
Object.defineProperty(exports, "getCatalogCheck", { enumerable: true, get: function () { return catalog_1.getCatalogCheck; } });
var links_1 = require("./checks/links");
Object.defineProperty(exports, "MAX_REDIRECT_HOPS", { enumerable: true, get: function () { return links_1.MAX_REDIRECT_HOPS; } });
var runner_1 = require("./runner");
Object.defineProperty(exports, "runChecks", { enumerable: true, get: function () { return runner_1.runChecks; } });
var scoring_1 = require("./scoring");
Object.defineProperty(exports, "computePageScore", { enumerable: true, get: function () { return scoring_1.computePageScore; } });
Object.defineProperty(exports, "SEVERITY_MULTIPLIER", { enumerable: true, get: function () { return scoring_1.SEVERITY_MULTIPLIER; } });
var version_1 = require("./version");
Object.defineProperty(exports, "ENGINE_VERSION", { enumerable: true, get: function () { return version_1.ENGINE_VERSION; } });
//# sourceMappingURL=index.js.map