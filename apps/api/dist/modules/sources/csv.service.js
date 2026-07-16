"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsvService = void 0;
exports.isHttpUrl = isHttpUrl;
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
const csv_parse_1 = require("csv-parse");
const MAX_INVALID_RATIO = 0.05;
const SAMPLE_LIMIT = 5;
function fail(message) {
    throw new common_1.BadRequestException({ code: shared_1.ERROR_CODES.CSV_INVALID, message });
}
/** Validates an uploaded URL CSV: shape, header, URL parseability. Pure parsing, no I/O. */
let CsvService = class CsvService {
    async validateUrlCsv(buffer, urlColumn) {
        if (buffer.length === 0)
            fail('CSV file is empty');
        // CSV has no magic bytes; reject binary uploads by scanning the first chunk for NUL.
        if (buffer.subarray(0, 8192).includes(0))
            fail('File is not a text CSV');
        return new Promise((resolve, reject) => {
            let rowCount = 0;
            let validUrlCount = 0;
            const invalidSamples = [];
            const parser = (0, csv_parse_1.parse)(buffer, {
                columns: true,
                bom: true,
                trim: true,
                skip_empty_lines: true,
                relax_column_count: true,
            });
            parser.on('readable', () => {
                let record;
                while ((record = parser.read()) !== null) {
                    if (rowCount === 0 && !(urlColumn in record)) {
                        parser.destroy();
                        reject(new common_1.BadRequestException({
                            code: shared_1.ERROR_CODES.CSV_INVALID,
                            message: `CSV has no '${urlColumn}' column; found: ${Object.keys(record).join(', ')}`,
                        }));
                        return;
                    }
                    rowCount += 1;
                    const value = record[urlColumn] ?? '';
                    if (isHttpUrl(value)) {
                        validUrlCount += 1;
                    }
                    else if (invalidSamples.length < SAMPLE_LIMIT) {
                        invalidSamples.push(value.slice(0, 200));
                    }
                }
            });
            parser.on('error', (err) => {
                reject(new common_1.BadRequestException({
                    code: shared_1.ERROR_CODES.CSV_INVALID,
                    message: `CSV parse error: ${err.message}`,
                }));
            });
            parser.on('end', () => {
                if (rowCount === 0) {
                    reject(new common_1.BadRequestException({
                        code: shared_1.ERROR_CODES.CSV_INVALID,
                        message: 'CSV has no data rows',
                    }));
                    return;
                }
                const invalid = rowCount - validUrlCount;
                if (validUrlCount === 0 || invalid / rowCount > MAX_INVALID_RATIO) {
                    reject(new common_1.BadRequestException({
                        code: shared_1.ERROR_CODES.CSV_INVALID,
                        message: `${invalid} of ${rowCount} rows have invalid URLs (examples: ${invalidSamples.join(' | ')})`,
                    }));
                    return;
                }
                resolve({ rowCount, validUrlCount, invalidSamples, urlColumn });
            });
        });
    }
};
exports.CsvService = CsvService;
exports.CsvService = CsvService = __decorate([
    (0, common_1.Injectable)()
], CsvService);
function isHttpUrl(value) {
    if (!value)
        return false;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=csv.service.js.map