"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runChecks = runChecks;
const checks_1 = require("./checks");
function runChecks(artifacts, site, overrides) {
    const disabled = overrides?.disabledCheckIds;
    const severityByCheckId = overrides?.severityByCheckId;
    const out = [];
    for (const check of checks_1.CHECKS) {
        if (disabled?.has(check.id)) {
            continue;
        }
        const results = check.run(artifacts, site);
        const severityOverride = severityByCheckId?.get(check.id);
        for (const result of results) {
            if (result.status !== 'fail' && result.status !== 'warning') {
                continue;
            }
            out.push(severityOverride !== undefined ? { ...result, severity: severityOverride } : result);
        }
    }
    return out;
}
//# sourceMappingURL=runner.js.map