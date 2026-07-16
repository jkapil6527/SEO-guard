import type { FetchOptions, FetchResult, SafeFetcherOptions } from './types';
/**
 * True when the IP must not be fetched by the crawler: loopback, RFC 1918,
 * CGNAT, link-local (cloud metadata), benchmarking, unspecified, multicast
 * and reserved ranges; for IPv6 additionally ULA and IPv4-mapped forms
 * (which recurse into the IPv4 check). Non-IP input returns true (fail
 * closed) — callers must pass a literal IP address.
 */
export declare function isPrivateAddress(ip: string): boolean;
export declare class SafeFetcher {
    private readonly options;
    private readonly allowPrivate;
    constructor(options: SafeFetcherOptions);
    fetch(url: string, opts?: FetchOptions): Promise<FetchResult>;
    /** Full SSRF guard; runs before the initial request and every redirect hop. */
    private guard;
    /** One HTTP exchange against the pinned address. Never rejects. */
    private performRequest;
    private failure;
}
