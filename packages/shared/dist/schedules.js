"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEDULE_PRESETS = void 0;
exports.isSchedulePreset = isSchedulePreset;
exports.presetToCron = presetToCron;
/**
 * Schedule presets map UI choices to cron expressions. "Manual" is intentionally
 * absent: a manual crawl is an on-demand action, not a schedule row.
 */
exports.SCHEDULE_PRESETS = {
    daily: '0 3 * * *',
    every_6_hours: '0 */6 * * *',
    weekly: '0 3 * * 1',
    monthly: '0 3 1 * *',
};
function isSchedulePreset(value) {
    return Object.prototype.hasOwnProperty.call(exports.SCHEDULE_PRESETS, value);
}
function presetToCron(preset) {
    return exports.SCHEDULE_PRESETS[preset];
}
//# sourceMappingURL=schedules.js.map