import type { ProblemDetails } from '@seo-guardian/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const BASE_URL = `${API_URL}/api/v1`;

/** Typed error carrying the RFC 7807 problem details returned by the API. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly fieldErrors: Array<{ field: string; message: string }>;

  constructor(problem: Partial<ProblemDetails>, fallbackStatus: number) {
    super(problem.detail ?? problem.title ?? `Request failed (${fallbackStatus})`);
    this.name = 'ApiError';
    this.status = problem.status ?? fallbackStatus;
    this.code = problem.code ?? 'UNKNOWN';
    this.detail = problem.detail;
    this.fieldErrors = problem.errors ?? [];
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: Partial<ProblemDetails> = {};
  try {
    problem = (await response.json()) as Partial<ProblemDetails>;
  } catch {
    // Non-JSON error body — fall back to the HTTP status.
  }
  return new ApiError(problem, response.status);
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Plain JSON fetch against the API. Authentication has been removed, so no
 * tokens or credentials are attached — every endpoint is open.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Multipart upload (e.g. CSV source). Does not set Content-Type — the browser adds the boundary. */
export async function uploadFile<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { method: 'POST', body: form });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

/** Absolute URL for a Server-Sent Events endpoint (e.g. crawl progress). */
export function sseUrl(path: string): string {
  return `${BASE_URL}${path}`;
}
