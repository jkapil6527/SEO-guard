/** Cursor-paginated list envelope returned by every list endpoint. */
export interface Paginated<T> {
    data: T[];
    meta: {
        nextCursor: string | null;
        total?: number;
    };
}
/** RFC 7807 problem details, extended with a stable machine-readable code. */
export interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail?: string;
    code: string;
    errors?: Array<{
        field: string;
        message: string;
    }>;
}
export interface AuthTokens {
    accessToken: string;
    /** Present for non-browser clients; browsers receive it as an httpOnly cookie instead. */
    refreshToken?: string;
}
export interface CurrentUser {
    id: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
    memberships: Array<{
        projectId: string;
        role: string;
    }>;
}
