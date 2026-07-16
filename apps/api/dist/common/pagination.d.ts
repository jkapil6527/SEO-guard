export declare class CursorQueryDto {
    limit?: number;
    cursor?: string;
}
export interface TimeCursor {
    createdAt: Date;
    id: string;
}
export declare function encodeTimeCursor(cursor: TimeCursor): string;
export declare function decodeTimeCursor(raw: string): TimeCursor;
