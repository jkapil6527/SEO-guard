import { BadRequestException, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@seo-guardian/shared';
import { parse } from 'csv-parse';

export interface CsvValidationResult {
  rowCount: number;
  validUrlCount: number;
  invalidSamples: string[];
  urlColumn: string;
}

const MAX_INVALID_RATIO = 0.05;
const SAMPLE_LIMIT = 5;

function fail(message: string): never {
  throw new BadRequestException({ code: ERROR_CODES.CSV_INVALID, message });
}

/** Validates an uploaded URL CSV: shape, header, URL parseability. Pure parsing, no I/O. */
@Injectable()
export class CsvService {
  async validateUrlCsv(buffer: Buffer, urlColumn: string): Promise<CsvValidationResult> {
    if (buffer.length === 0) fail('CSV file is empty');
    // CSV has no magic bytes; reject binary uploads by scanning the first chunk for NUL.
    if (buffer.subarray(0, 8192).includes(0)) fail('File is not a text CSV');

    return new Promise<CsvValidationResult>((resolve, reject) => {
      let rowCount = 0;
      let validUrlCount = 0;
      const invalidSamples: string[] = [];

      const parser = parse(buffer, {
        columns: true,
        bom: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
      });

      parser.on('readable', () => {
        let record: Record<string, string> | null;
        while ((record = parser.read() as Record<string, string> | null) !== null) {
          if (rowCount === 0 && !(urlColumn in record)) {
            parser.destroy();
            reject(
              new BadRequestException({
                code: ERROR_CODES.CSV_INVALID,
                message: `CSV has no '${urlColumn}' column; found: ${Object.keys(record).join(', ')}`,
              }),
            );
            return;
          }
          rowCount += 1;
          const value = record[urlColumn] ?? '';
          if (isHttpUrl(value)) {
            validUrlCount += 1;
          } else if (invalidSamples.length < SAMPLE_LIMIT) {
            invalidSamples.push(value.slice(0, 200));
          }
        }
      });

      parser.on('error', (err) => {
        reject(
          new BadRequestException({
            code: ERROR_CODES.CSV_INVALID,
            message: `CSV parse error: ${err.message}`,
          }),
        );
      });

      parser.on('end', () => {
        if (rowCount === 0) {
          reject(
            new BadRequestException({
              code: ERROR_CODES.CSV_INVALID,
              message: 'CSV has no data rows',
            }),
          );
          return;
        }
        const invalid = rowCount - validUrlCount;
        if (validUrlCount === 0 || invalid / rowCount > MAX_INVALID_RATIO) {
          reject(
            new BadRequestException({
              code: ERROR_CODES.CSV_INVALID,
              message: `${invalid} of ${rowCount} rows have invalid URLs (examples: ${invalidSamples.join(' | ')})`,
            }),
          );
          return;
        }
        resolve({ rowCount, validUrlCount, invalidSamples, urlColumn });
      });
    });
  }
}

export function isHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
