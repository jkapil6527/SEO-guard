"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheck = createCheck;
exports.passed = passed;
function createCheck(spec) {
    const definition = {
        id: spec.id,
        name: spec.name,
        category: spec.category,
        defaultSeverity: spec.defaultSeverity,
        weight: spec.weight,
        description: spec.description,
        technicalExplanation: spec.technicalExplanation,
        suggestedFix: spec.suggestedFix,
        run(artifacts, site) {
            return spec.evaluate(artifacts, site).map((partial) => {
                const result = {
                    ruleId: spec.id,
                    ruleName: spec.name,
                    severity: spec.defaultSeverity,
                    status: partial.status,
                    message: partial.message,
                    technicalExplanation: spec.technicalExplanation,
                    suggestedFix: spec.suggestedFix,
                };
                if (partial.affectedElement !== undefined) {
                    result.affectedElement = partial.affectedElement;
                }
                if (partial.metadata !== undefined) {
                    result.metadata = partial.metadata;
                }
                return result;
            });
        },
    };
    if (spec.docUrl !== undefined) {
        definition.docUrl = spec.docUrl;
    }
    return definition;
}
/** Convenience: a single passing result for a satisfied check. */
function passed(message) {
    return [{ status: 'pass', message }];
}
//# sourceMappingURL=factory.js.map