"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHECKS = void 0;
exports.getCheck = getCheck;
const meta_1 = require("./checks/meta");
const headings_1 = require("./checks/headings");
const images_1 = require("./checks/images");
const links_1 = require("./checks/links");
const technical_1 = require("./checks/technical");
const social_1 = require("./checks/social");
const ALL_CHECKS = [
    ...meta_1.metaChecks,
    ...headings_1.headingChecks,
    ...images_1.imageChecks,
    ...links_1.linkChecks,
    ...technical_1.technicalChecks,
    ...social_1.socialChecks,
];
const CHECK_INDEX = new Map();
for (const check of ALL_CHECKS) {
    if (CHECK_INDEX.has(check.id)) {
        throw new Error(`Duplicate check id in catalog: ${check.id}`);
    }
    CHECK_INDEX.set(check.id, check);
}
exports.CHECKS = ALL_CHECKS;
/** Looks up a check definition by id, or undefined when unknown. */
function getCheck(id) {
    return CHECK_INDEX.get(id);
}
//# sourceMappingURL=checks.js.map