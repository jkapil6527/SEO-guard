"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidTimezone = assertValidTimezone;
exports.resolveCron = resolveCron;
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
const cron_parser_1 = require("cron-parser");
/** Politeness floor: schedules may not fire more often than this. */
const MIN_INTERVAL_MS = 5 * 60 * 1000;
function assertValidTimezone(timezone) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    }
    catch {
        throw new common_1.BadRequestException({
            code: shared_1.ERROR_CODES.INVALID_TIMEZONE,
            message: `Unknown IANA timezone: ${timezone}`,
        });
    }
}
/**
 * Resolves a preset or raw cron into a validated cron expression and computes
 * the next run. Rejects expressions firing more often than every 5 minutes.
 */
function resolveCron(input) {
    const { preset, cron, timezone } = input;
    if ((preset && cron) || (!preset && !cron)) {
        throw new common_1.BadRequestException({
            code: shared_1.ERROR_CODES.INVALID_CRON,
            message: "Provide exactly one of 'preset' or 'cron'",
        });
    }
    const expression = preset
        ? (0, shared_1.isSchedulePreset)(preset)
            ? (0, shared_1.presetToCron)(preset)
            : invalid(`Unknown preset: ${preset}`)
        : cron;
    let interval;
    try {
        interval = cron_parser_1.CronExpressionParser.parse(expression, { tz: timezone });
    }
    catch (err) {
        return invalid(`Invalid cron expression '${expression}': ${err.message}`);
    }
    const first = interval.next().toDate();
    const second = interval.next().toDate();
    if (second.getTime() - first.getTime() < MIN_INTERVAL_MS) {
        return invalid(`Schedule fires too frequently (${expression}); minimum interval is 5 minutes`);
    }
    return { cron: expression, nextRunAt: first };
}
function invalid(message) {
    throw new common_1.BadRequestException({ code: shared_1.ERROR_CODES.INVALID_CRON, message });
}
//# sourceMappingURL=cron.util.js.map