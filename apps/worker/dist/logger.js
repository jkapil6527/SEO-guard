"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerLogger = void 0;
const pino_1 = __importDefault(require("pino"));
/** pino adapter for Nest's LoggerService in a non-HTTP application context. */
class WorkerLogger {
    logger;
    constructor() {
        this.logger = (0, pino_1.default)({
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
        });
    }
    log(message, context) {
        this.logger.info({ context }, String(message));
    }
    error(message, trace, context) {
        this.logger.error({ context, trace }, String(message));
    }
    warn(message, context) {
        this.logger.warn({ context }, String(message));
    }
    debug(message, context) {
        this.logger.debug({ context }, String(message));
    }
    verbose(message, context) {
        this.logger.trace({ context }, String(message));
    }
}
exports.WorkerLogger = WorkerLogger;
//# sourceMappingURL=logger.js.map