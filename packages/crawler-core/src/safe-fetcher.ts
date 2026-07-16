/**
 * SSRF-guarded HTTP(S) fetcher (threat T1 in docs/09-security-testing.md).
 *
 * Guard sequence, applied to the initial URL and to EVERY redirect hop:
 *   1. Parse; only http/https allowed.
 *   2. Block privileged ports (< 1024) other than 80/443.
 *   3. If the host is an IP literal, reject private/link-local/loopback/
 *      metadata addresses. Otherwise resolve it ONCE with dns.lookup and
 *      reject if ANY resolved address is private.
 *   4. Pin the vetted address: the actual socket connects to the resolved IP
 *      via a custom `lookup` callback, so there is no second DNS resolution
 *      (no TOCTOU window between the check and the connect). SNI and the Host
 *      header carry the original hostname.
 *
 * `allowPrivateTargets` (host:port entries) is a test/fixture escape hatch:
 * matching targets skip the private-address and port checks but still get
 * resolved and pinned.
 *
 * The fetcher never throws for network/HTTP problems; failures come back as
 * a FetchResult with `error` set. Only programmer errors throw.
 */
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import type {
  FetchErrorCode,
  FetchOptions,
  FetchResult,
  RedirectHop,
  SafeFetcherOptions,
} from './types';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * True when the IP must not be fetched by the crawler: loopback, RFC 1918,
 * CGNAT, link-local (cloud metadata), benchmarking, unspecified, multicast
 * and reserved ranges; for IPv6 additionally ULA and IPv4-mapped forms
 * (which recurse into the IPv4 check). Non-IP input returns true (fail
 * closed) — callers must pass a literal IP address.
 */
export function isPrivateAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateIPv4(ip);
  }
  if (version === 6) {
    return isPrivateIPv6(ip);
  }
  return true; // not an IP address: fail closed
}

function isPrivateIPv4(ip: string): boolean {
  const octets = ip.split('.').map((part) => parseInt(part, 10));
  const [a, b] = octets;
  if (octets.length !== 4 || a === undefined || b === undefined) {
    return true;
  }
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // 10.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    a === 127 || // 127.0.0.0/8 loopback
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
    a >= 224 // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + broadcast
  );
}

function isPrivateIPv6(ip: string): boolean {
  const groups = expandIPv6(ip);
  if (groups === null) {
    return true; // unparseable: fail closed
  }
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    if (g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) {
      return true; // :: (unspecified) and ::1 (loopback)
    }
    if (g5 === 0xffff) {
      // ::ffff:a.b.c.d IPv4-mapped — apply the IPv4 rules
      return isPrivateIPv4(`${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`);
    }
  }
  if ((g0 & 0xfe00) === 0xfc00) {
    return true; // fc00::/7 unique local
  }
  if ((g0 & 0xffc0) === 0xfe80) {
    return true; // fe80::/10 link-local
  }
  if ((g0 & 0xff00) === 0xff00) {
    return true; // ff00::/8 multicast
  }
  return false;
}

/** Expands an IPv6 string to its eight 16-bit groups; null when malformed. */
function expandIPv6(ip: string): number[] | null {
  let text = ip;
  const zoneIndex = text.indexOf('%');
  if (zoneIndex !== -1) {
    text = text.slice(0, zoneIndex);
  }
  // Fold an embedded IPv4 tail (::ffff:192.168.0.1) into two hex groups.
  if (text.includes('.')) {
    const lastColon = text.lastIndexOf(':');
    const v4 = text.slice(lastColon + 1);
    if (net.isIP(v4) !== 4) {
      return null;
    }
    const [o0 = 0, o1 = 0, o2 = 0, o3 = 0] = v4.split('.').map((part) => parseInt(part, 10));
    const hi = ((o0 << 8) | o1).toString(16);
    const lo = ((o2 << 8) | o3).toString(16);
    text = `${text.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) {
    return null;
  }
  const head = halves[0] === undefined || halves[0] === '' ? [] : halves[0].split(':');
  const tail =
    halves.length === 2 && halves[1] !== undefined && halves[1] !== '' ? halves[1].split(':') : [];
  let raw: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
      return null;
    }
    raw = [...head, ...(Array(missing).fill('0') as string[]), ...tail];
  } else {
    raw = head;
  }
  if (raw.length !== 8) {
    return null;
  }
  const groups: number[] = [];
  for (const part of raw) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
      return null;
    }
    groups.push(parseInt(part, 16));
  }
  return groups;
}

interface GuardPass {
  ok: true;
  url: URL;
  /** Hostname without IPv6 brackets. */
  bareHost: string;
  port: number;
  /** The vetted IP address the socket must connect to. */
  address: string;
  family: 4 | 6;
}

interface GuardFail {
  ok: false;
  code: FetchErrorCode;
  message: string;
}

type GuardResult = GuardPass | GuardFail;

interface ExchangeResponse {
  kind: 'response';
  status: number;
  headers: Record<string, string>;
  body?: Buffer;
}

interface ExchangeFailure {
  kind: 'error';
  code: FetchErrorCode;
  message: string;
}

type Exchange = ExchangeResponse | ExchangeFailure;

export class SafeFetcher {
  private readonly options: SafeFetcherOptions;
  private readonly allowPrivate: Set<string>;

  constructor(options: SafeFetcherOptions) {
    this.options = options;
    this.allowPrivate = new Set(
      (options.allowPrivateTargets ?? []).map((target) => target.toLowerCase()),
    );
  }

  async fetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
    const started = Date.now();
    const timeoutMs = opts.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRedirects = opts.maxRedirects ?? this.options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    const maxBodyBytes = opts.maxBodyBytes ?? this.options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    const deadline = started + timeoutMs;
    const redirectChain: RedirectHop[] = [];
    let method: 'GET' | 'HEAD' = opts.method ?? 'GET';
    let currentUrl = url;

    for (;;) {
      const guard = await this.guard(currentUrl);
      if (!guard.ok) {
        return this.failure(currentUrl, redirectChain, started, guard.code, guard.message);
      }
      const canonicalUrl = guard.url.toString();
      if (Date.now() >= deadline) {
        return this.failure(
          canonicalUrl,
          redirectChain,
          started,
          'TIMEOUT',
          `timed out after ${timeoutMs}ms`,
        );
      }
      const exchange = await this.performRequest(guard, method, opts, maxBodyBytes, deadline);
      if (exchange.kind === 'error') {
        return this.failure(canonicalUrl, redirectChain, started, exchange.code, exchange.message);
      }
      const location = exchange.headers['location'];
      if (REDIRECT_STATUSES.has(exchange.status) && location !== undefined) {
        redirectChain.push({ url: canonicalUrl, status: exchange.status });
        if (redirectChain.length > maxRedirects) {
          return this.failure(
            canonicalUrl,
            redirectChain,
            started,
            'TOO_MANY_REDIRECTS',
            `exceeded ${maxRedirects} redirects`,
          );
        }
        let next: URL;
        try {
          next = new URL(location, guard.url);
        } catch {
          return this.failure(
            canonicalUrl,
            redirectChain,
            started,
            'CONNECTION_ERROR',
            `invalid redirect Location: ${location}`,
          );
        }
        if (exchange.status === 303 && method !== 'HEAD') {
          method = 'GET';
        }
        currentUrl = next.toString();
        continue;
      }
      const notModified = exchange.status === 304;
      const result: FetchResult = {
        finalUrl: canonicalUrl,
        status: exchange.status,
        ok: (exchange.status >= 200 && exchange.status < 300) || notModified,
        notModified,
        headers: exchange.headers,
        redirectChain,
        timings: { totalMs: Date.now() - started },
      };
      if (exchange.body !== undefined) {
        result.body = exchange.body;
      }
      return result;
    }
  }

  /** Full SSRF guard; runs before the initial request and every redirect hop. */
  private async guard(urlStr: string): Promise<GuardResult> {
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      return { ok: false, code: 'CONNECTION_ERROR', message: `invalid URL: ${urlStr}` };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        ok: false,
        code: 'UNSUPPORTED_PROTOCOL',
        message: `unsupported protocol: ${url.protocol}`,
      };
    }
    const port = url.port !== '' ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
    const bareHost =
      url.hostname.startsWith('[') && url.hostname.endsWith(']')
        ? url.hostname.slice(1, -1)
        : url.hostname;
    const allowListed =
      this.allowPrivate.has(`${bareHost.toLowerCase()}:${port}`) ||
      this.allowPrivate.has(`${url.hostname.toLowerCase()}:${port}`);
    if (!allowListed && port !== 80 && port !== 443 && port < 1024) {
      return { ok: false, code: 'SSRF_BLOCKED', message: `port ${port} is not allowed` };
    }
    const literal = net.isIP(bareHost);
    if (literal !== 0) {
      if (!allowListed && isPrivateAddress(bareHost)) {
        return {
          ok: false,
          code: 'SSRF_BLOCKED',
          message: `address ${bareHost} is in a blocked range`,
        };
      }
      return { ok: true, url, bareHost, port, address: bareHost, family: literal as 4 | 6 };
    }
    let records: Array<{ address: string; family: number }>;
    try {
      records = await dns.promises.lookup(bareHost, { all: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, code: 'DNS_ERROR', message: `DNS lookup failed: ${message}` };
    }
    const first = records[0];
    if (first === undefined) {
      return { ok: false, code: 'DNS_ERROR', message: `no addresses for ${bareHost}` };
    }
    if (!allowListed) {
      // ANY private record blocks the request: an attacker controlling DNS
      // must not be able to smuggle one private A record among public ones.
      const bad = records.find((record) => isPrivateAddress(record.address));
      if (bad !== undefined) {
        return {
          ok: false,
          code: 'SSRF_BLOCKED',
          message: `${bareHost} resolves to blocked address ${bad.address}`,
        };
      }
    }
    return {
      ok: true,
      url,
      bareHost,
      port,
      address: first.address,
      family: first.family === 6 ? 6 : 4,
    };
  }

  /** One HTTP exchange against the pinned address. Never rejects. */
  private performRequest(
    guard: GuardPass,
    method: 'GET' | 'HEAD',
    opts: FetchOptions,
    maxBodyBytes: number,
    deadline: number,
  ): Promise<Exchange> {
    return new Promise<Exchange>((resolve) => {
      const { url, bareHost, port, address, family } = guard;
      const isTls = url.protocol === 'https:';
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        resolve({ kind: 'error', code: 'TIMEOUT', message: 'timed out before request start' });
        return;
      }

      const headers: Record<string, string> = {
        'user-agent': opts.userAgent ?? this.options.userAgent,
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br',
        connection: 'close',
      };
      if (opts.etag !== undefined) {
        headers['if-none-match'] = opts.etag;
      }
      if (opts.lastModified !== undefined) {
        headers['if-modified-since'] = opts.lastModified;
      }
      if (opts.headers !== undefined) {
        for (const [name, value] of Object.entries(opts.headers)) {
          headers[name.toLowerCase()] = value;
        }
      }
      // Host header always carries the original authority, not the pinned IP.
      headers['host'] = url.host;

      // DNS pinning: the socket resolves through this callback only, which
      // returns the address vetted by guard() — no second lookup, no TOCTOU.
      const pinnedLookup: net.LookupFunction = (_hostname, lookupOpts, callback) => {
        if (lookupOpts.all === true) {
          callback(null, [{ address, family }]);
        } else {
          callback(null, address, family);
        }
      };

      // `finish` closes over `req` and `timer`, which are assigned right
      // below; every path that can invoke it (response/error events, the
      // timer) is asynchronous, so both are initialized by the time it runs.
      let settled = false;
      const finish = (outcome: Exchange, destroy: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (destroy) {
          req.destroy();
        }
        resolve(outcome);
      };

      const requestOptions: https.RequestOptions = {
        host: bareHost,
        port,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        lookup: pinnedLookup,
        agent: false, // fresh connection per request; 'connection: close' above
      };
      if (isTls) {
        // SNI must be the original hostname (never the pinned IP). Empty SNI
        // for IP-literal targets, per RFC 6066.
        requestOptions.servername = net.isIP(bareHost) === 0 ? bareHost : '';
      }

      const transport = isTls ? https : http;
      const req = transport.request(requestOptions, (res) => {
        const status = res.statusCode ?? 0;
        const responseHeaders = flattenHeaders(res.headers);
        const skipBody =
          method === 'HEAD' ||
          status === 304 ||
          (REDIRECT_STATUSES.has(status) && responseHeaders['location'] !== undefined);
        if (skipBody) {
          res.resume(); // drain so the socket can close cleanly
          finish({ kind: 'response', status, headers: responseHeaders }, false);
          return;
        }

        const contentEncoding = (responseHeaders['content-encoding'] ?? '').trim().toLowerCase();
        let source: NodeJS.ReadableStream = res;
        const decompressor =
          contentEncoding === 'gzip' || contentEncoding === 'x-gzip'
            ? zlib.createGunzip()
            : contentEncoding === 'deflate'
              ? zlib.createInflate()
              : contentEncoding === 'br'
                ? zlib.createBrotliDecompress()
                : null;
        if (decompressor !== null) {
          res.pipe(decompressor);
          source = decompressor;
        }
        const chunks: Buffer[] = [];
        let total = 0; // counts DECOMPRESSED bytes when gzip is in play
        source.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBodyBytes) {
            finish(
              {
                kind: 'error',
                code: 'BODY_TOO_LARGE',
                message: `body exceeded ${maxBodyBytes} bytes`,
              },
              true,
            );
            return;
          }
          chunks.push(chunk);
        });
        source.on('end', () => {
          finish(
            { kind: 'response', status, headers: responseHeaders, body: Buffer.concat(chunks) },
            false,
          );
        });
        source.on('error', (err: Error) => {
          finish({ kind: 'error', code: 'CONNECTION_ERROR', message: err.message }, true);
        });
        if (source !== res) {
          res.on('error', (err: Error) => {
            finish({ kind: 'error', code: 'CONNECTION_ERROR', message: err.message }, true);
          });
        }
      });

      const timer = setTimeout(() => {
        finish({ kind: 'error', code: 'TIMEOUT', message: `timed out after ${remaining}ms` }, true);
      }, remaining);

      req.on('error', (err: NodeJS.ErrnoException) => {
        const code: FetchErrorCode =
          err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' ? 'TIMEOUT' : 'CONNECTION_ERROR';
        finish({ kind: 'error', code, message: err.message }, true);
      });
      req.end();
    });
  }

  private failure(
    finalUrl: string,
    redirectChain: RedirectHop[],
    started: number,
    code: FetchErrorCode,
    message: string,
  ): FetchResult {
    return {
      finalUrl,
      status: 0,
      ok: false,
      notModified: false,
      headers: {},
      redirectChain,
      timings: { totalMs: Date.now() - started },
      error: { code, message },
    };
  }
}

function flattenHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    out[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
}
