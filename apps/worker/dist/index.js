"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerLogger = exports.WorkerModule = void 0;
/** Importable surface of the worker (no bootstrap side effect; see main.ts for that). */
var worker_module_1 = require("./worker.module");
Object.defineProperty(exports, "WorkerModule", { enumerable: true, get: function () { return worker_module_1.WorkerModule; } });
var logger_1 = require("./logger");
Object.defineProperty(exports, "WorkerLogger", { enumerable: true, get: function () { return logger_1.WorkerLogger; } });
//# sourceMappingURL=index.js.map