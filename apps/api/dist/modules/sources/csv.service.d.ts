export interface CsvValidationResult {
    rowCount: number;
    validUrlCount: number;
    invalidSamples: string[];
    urlColumn: string;
}
/** Validates an uploaded URL CSV: shape, header, URL parseability. Pure parsing, no I/O. */
export declare class CsvService {
    validateUrlCsv(buffer: Buffer, urlColumn: string): Promise<CsvValidationResult>;
}
export declare function isHttpUrl(value: string): boolean;
