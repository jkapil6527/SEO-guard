import { EventEmitter } from 'node:events';
import dns from 'node:dns';
import type http from 'node:http';
import https from 'node:https';
import { PassThrough } from 'node:stream';
import zlib from 'node:zlib';
import { SafeFetcher, isPrivateAddress } from './safe-fetcher';
import { startFixtureServer } from './test-support/fixture-server';
import type { FixtureServer } from './test-support/fixture-server';

describe('isPrivateAddress', () => {
  it.each([
    '0.0.0.0',
    '0.255.1.2',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1',
    '100.127.255.254',
    '127.0.0.1',
    '127.255.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '192.168.255.255',
    '198.18.0.1',
    '198.19.255.255',
    '224.0.0.1',
    '255.255.255.255',
  ])('blocks IPv4 %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '100.63.255.255',
    '100.128.0.1',
    '172.15.255.255',
    '172.32.0.1',
    '198.17.0.1',
    '198.20.0.1',
    '169.253.1.1',
  ])('allows public IPv4 %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it.each([
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'febf::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.5',
    '::ffff:192.168.1.1',
    '::ffff:7f00:1', // ::ffff:127.0.0.1 in hex form
    'fe80::1%eth0',
  ])('blocks IPv6 %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['2001:4860:4860::8888', '2606:4700::1111', '::ffff:8.8.8.8'])(
    'allows public IPv6 %s',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it('fails closed for non-IP input', () => {
    expect(isPrivateAddress('example.com')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});

describe('SafeFetcher', () => {
  const UA = 'SEOGuardianBot/1.0';
  let server: FixtureServer;
  let fetcher: SafeFetcher;

  beforeAll(async () => {
    server = await startFixtureServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${server.port}`);
      switch (url.pathname) {
        case '/ok':
          res.writeHead(200, { 'Content-Type': 'text/html', 'X-Fixture': 'yes' });
          res.end('<html>hello</html>');
          return;
        case '/echo':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ method: req.method, headers: req.headers }));
          return;
        case '/gzip': {
          const body = zlib.gzipSync(Buffer.from('gzip payload contents'));
          res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
          res.end(body);
          return;
        }
        case '/bomb': {
          // 256 KiB of zeros compresses to a few hundred bytes.
          const body = zlib.gzipSync(Buffer.alloc(256 * 1024));
          res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
          res.end(body);
          return;
        }
        case '/big':
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
          res.end(Buffer.alloc(64 * 1024, 0x61));
          return;
        case '/cond':
          if (req.headers['if-none-match'] === '"v1"') {
            res.writeHead(304, { ETag: '"v1"' });
            res.end();
          } else {
            res.writeHead(200, { ETag: '"v1"', 'Content-Type': 'text/plain' });
            res.end('fresh body');
          }
          return;
        case '/r1':
          res.writeHead(302, { Location: '/r2' });
          res.end();
          return;
        case '/r2':
          res.writeHead(301, { Location: url.origin + '/ok' });
          res.end();
          return;
        case '/loop':
          res.writeHead(302, { Location: '/loop' });
          res.end();
          return;
        case '/to-metadata':
          res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
          res.end();
          return;
        case '/to-ftp':
          res.writeHead(302, { Location: 'ftp://127.0.0.1/file' });
          res.end();
          return;
        case '/hang':
          return; // never respond
        case '/slow-body':
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.write('partial');
          return; // never finish the body
        default:
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('not found');
      }
    });
    fetcher = new SafeFetcher({
      userAgent: UA,
      allowPrivateTargets: [server.allowTarget],
    });
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('performs a plain GET and lowercases response headers', async () => {
    const result = await fetcher.fetch(server.url('/ok'));
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.notModified).toBe(false);
    expect(result.finalUrl).toBe(server.url('/ok'));
    expect(result.body?.toString()).toBe('<html>hello</html>');
    expect(result.headers['x-fixture']).toBe('yes');
    expect(result.headers['content-type']).toBe('text/html');
    expect(result.redirectChain).toEqual([]);
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('sends UA, Accept, Accept-Encoding and custom headers', async () => {
    const result = await fetcher.fetch(server.url('/echo'), {
      headers: { 'X-Custom': 'abc' },
    });
    const echoed = JSON.parse(result.body?.toString() ?? '{}') as {
      headers: Record<string, string>;
    };
    expect(echoed.headers['user-agent']).toBe(UA);
    expect(echoed.headers['accept']).toBe('*/*');
    expect(echoed.headers['accept-encoding']).toBe('gzip, deflate, br');
    expect(echoed.headers['x-custom']).toBe('abc');
  });

  it('lets opts.userAgent override the constructor user agent', async () => {
    const result = await fetcher.fetch(server.url('/echo'), { userAgent: 'OverrideBot/2.0' });
    const echoed = JSON.parse(result.body?.toString() ?? '{}') as {
      headers: Record<string, string>;
    };
    expect(echoed.headers['user-agent']).toBe('OverrideBot/2.0');
  });

  it('decompresses gzip responses', async () => {
    const result = await fetcher.fetch(server.url('/gzip'));
    expect(result.status).toBe(200);
    expect(result.body?.toString()).toBe('gzip payload contents');
  });

  it('HEAD requests carry no body', async () => {
    const result = await fetcher.fetch(server.url('/ok'), { method: 'HEAD' });
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.body).toBeUndefined();
  });

  it('handles conditional GET with a 304', async () => {
    const fresh = await fetcher.fetch(server.url('/cond'));
    expect(fresh.status).toBe(200);
    expect(fresh.body?.toString()).toBe('fresh body');

    const cached = await fetcher.fetch(server.url('/cond'), { etag: '"v1"' });
    expect(cached.status).toBe(304);
    expect(cached.ok).toBe(true);
    expect(cached.notModified).toBe(true);
    expect(cached.body).toBeUndefined();
  });

  it('sends If-None-Match and If-Modified-Since from opts', async () => {
    const result = await fetcher.fetch(server.url('/echo'), {
      etag: '"e1"',
      lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT',
    });
    const echoed = JSON.parse(result.body?.toString() ?? '{}') as {
      headers: Record<string, string>;
    };
    expect(echoed.headers['if-none-match']).toBe('"e1"');
    expect(echoed.headers['if-modified-since']).toBe('Wed, 01 Jan 2025 00:00:00 GMT');
  });

  it('follows redirects (relative and absolute) and records the chain', async () => {
    const result = await fetcher.fetch(server.url('/r1'));
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe(server.url('/ok'));
    expect(result.redirectChain).toEqual([
      { url: server.url('/r1'), status: 302 },
      { url: server.url('/r2'), status: 301 },
    ]);
    expect(result.body?.toString()).toBe('<html>hello</html>');
  });

  it('fails with TOO_MANY_REDIRECTS on a loop', async () => {
    const result = await fetcher.fetch(server.url('/loop'), { maxRedirects: 3 });
    expect(result.error?.code).toBe('TOO_MANY_REDIRECTS');
    expect(result.status).toBe(0);
    expect(result.ok).toBe(false);
    expect(result.redirectChain).toHaveLength(4);
  });

  it('re-runs the SSRF guard on every redirect hop (metadata IP)', async () => {
    const result = await fetcher.fetch(server.url('/to-metadata'));
    expect(result.error?.code).toBe('SSRF_BLOCKED');
    expect(result.redirectChain).toEqual([{ url: server.url('/to-metadata'), status: 302 }]);
  });

  it('rejects redirects to non-http protocols', async () => {
    const result = await fetcher.fetch(server.url('/to-ftp'));
    expect(result.error?.code).toBe('UNSUPPORTED_PROTOCOL');
  });

  it('caps the body size with BODY_TOO_LARGE', async () => {
    const result = await fetcher.fetch(server.url('/big'), { maxBodyBytes: 1024 });
    expect(result.error?.code).toBe('BODY_TOO_LARGE');
    expect(result.body).toBeUndefined();
  });

  it('applies the size cap to DECOMPRESSED bytes', async () => {
    const result = await fetcher.fetch(server.url('/bomb'), { maxBodyBytes: 16 * 1024 });
    expect(result.error?.code).toBe('BODY_TOO_LARGE');
  });

  it('times out when the server never responds', async () => {
    const result = await fetcher.fetch(server.url('/hang'), { timeoutMs: 300 });
    expect(result.error?.code).toBe('TIMEOUT');
    expect(result.status).toBe(0);
  });

  it('the timeout covers the body phase too', async () => {
    const result = await fetcher.fetch(server.url('/slow-body'), { timeoutMs: 300 });
    expect(result.error?.code).toBe('TIMEOUT');
  });

  it('rejects non-http(s) URLs', async () => {
    const result = await fetcher.fetch('ftp://example.com/file');
    expect(result.error?.code).toBe('UNSUPPORTED_PROTOCOL');
  });

  it('reports unparseable URLs as CONNECTION_ERROR without throwing', async () => {
    const result = await fetcher.fetch('http://');
    expect(result.error?.code).toBe('CONNECTION_ERROR');
  });

  it('blocks privileged ports without any network activity', async () => {
    const lookupSpy = jest.spyOn(dns.promises, 'lookup');
    const result = await fetcher.fetch('http://example.com:22/');
    expect(result.error?.code).toBe('SSRF_BLOCKED');
    expect(result.error?.message).toContain('port 22');
    expect(lookupSpy).not.toHaveBeenCalled();
  });

  it.each([
    'http://127.0.0.1/',
    'http://10.1.2.3/',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.1.1:8080/',
    'http://[::1]:8080/',
    'http://[fd00::1]/',
    'http://0.0.0.0/',
  ])('blocks private/metadata IP literal %s', async (target) => {
    const result = await fetcher.fetch(target);
    expect(result.error?.code).toBe('SSRF_BLOCKED');
  });

  it('blocks hostnames when ANY resolved address is private', async () => {
    jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ] as never);
    const result = await fetcher.fetch('http://rebind.test/');
    expect(result.error?.code).toBe('SSRF_BLOCKED');
    expect(result.error?.message).toContain('10.0.0.5');
  });

  it('returns DNS_ERROR when resolution fails', async () => {
    jest
      .spyOn(dns.promises, 'lookup')
      .mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }));
    const result = await fetcher.fetch('http://nonexistent.test/');
    expect(result.error?.code).toBe('DNS_ERROR');
  });

  it('pins the vetted resolved IP and keeps the original Host header', async () => {
    const lookupSpy = jest
      .spyOn(dns.promises, 'lookup')
      .mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    const pinned = new SafeFetcher({
      userAgent: UA,
      allowPrivateTargets: [`site.test:${server.port}`],
    });
    const result = await pinned.fetch(`http://site.test:${server.port}/echo`);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(lookupSpy).toHaveBeenCalledTimes(1); // resolved exactly once, then pinned
    const echoed = JSON.parse(result.body?.toString() ?? '{}') as {
      headers: Record<string, string>;
    };
    expect(echoed.headers['host']).toBe(`site.test:${server.port}`);
  });

  it('returns CONNECTION_ERROR when the target refuses connections', async () => {
    const closed = await startFixtureServer(() => undefined);
    await closed.close();
    const local = new SafeFetcher({ userAgent: UA, allowPrivateTargets: [closed.allowTarget] });
    const result = await local.fetch(closed.url('/'));
    expect(result.error?.code).toBe('CONNECTION_ERROR');
    expect(result.status).toBe(0);
  });

  it('uses the vetted address and original SNI for https', async () => {
    jest
      .spyOn(dns.promises, 'lookup')
      .mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    let captured: https.RequestOptions | undefined;
    jest.spyOn(https, 'request').mockImplementation(((
      options: https.RequestOptions,
      callback: (res: http.IncomingMessage) => void,
    ) => {
      captured = options;
      const res = new PassThrough() as unknown as http.IncomingMessage & PassThrough;
      (res as any).statusCode = 200;
      (res as any).headers = { 'content-type': 'text/html' };
      const req = Object.assign(new EventEmitter(), {
        end: () => {
          setImmediate(() => {
            callback(res);
            res.end(Buffer.from('secure content'));
          });
        },
        destroy: () => undefined,
      });
      return req as unknown as http.ClientRequest;
    }) as never);

    const result = await fetcher.fetch('https://example.com/page');
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.body?.toString()).toBe('secure content');

    expect(captured).toBeDefined();
    expect(captured?.servername).toBe('example.com');
    expect(captured?.port).toBe(443);
    expect((captured?.headers as Record<string, string>)['host']).toBe('example.com');
    // The lookup callback must return the vetted address, not re-resolve.
    const address = await new Promise<string>((resolve, reject) => {
      captured?.lookup?.('example.com', {} as never, (err, addr) => {
        if (err) {
          reject(err);
        } else {
          resolve(addr as string);
        }
      });
    });
    expect(address).toBe('93.184.216.34');
  });

  it('never throws for transport failures (contract check)', async () => {
    const targets = [
      'http://',
      'ftp://x/',
      'http://127.0.0.1:22/',
      'http://192.168.0.1/',
      server.url('/hang'),
    ];
    for (const target of targets) {
      await expect(fetcher.fetch(target, { timeoutMs: 250 })).resolves.toMatchObject({
        ok: false,
        error: expect.anything(),
      });
    }
  });
});
