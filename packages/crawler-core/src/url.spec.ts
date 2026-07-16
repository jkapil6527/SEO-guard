import { normalizeUrl, registrableDomain, urlHash } from './url';

describe('normalizeUrl', () => {
  it('lowercases scheme and host', () => {
    expect(normalizeUrl('HTTP://Example.COM/Path')).toBe('http://example.com/Path');
  });

  it('preserves path case', () => {
    expect(normalizeUrl('https://example.com/CaseSensitive')).toBe(
      'https://example.com/CaseSensitive',
    );
  });

  it('strips fragments', () => {
    expect(normalizeUrl('https://example.com/a#section')).toBe('https://example.com/a');
  });

  it('strips default ports', () => {
    expect(normalizeUrl('http://example.com:80/a')).toBe('http://example.com/a');
    expect(normalizeUrl('https://example.com:443/a')).toBe('https://example.com/a');
  });

  it('keeps explicit non-default ports', () => {
    expect(normalizeUrl('http://example.com:8080/a')).toBe('http://example.com:8080/a');
    expect(normalizeUrl('http://example.com:443/a')).toBe('http://example.com:443/a');
  });

  it('turns an empty path into /', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('preserves trailing slashes as given', () => {
    expect(normalizeUrl('https://example.com/dir/')).toBe('https://example.com/dir/');
    expect(normalizeUrl('https://example.com/dir')).toBe('https://example.com/dir');
  });

  it('resolves dot segments', () => {
    expect(normalizeUrl('https://example.com/a/b/../c/./d')).toBe('https://example.com/a/c/d');
  });

  it('collapses duplicate slashes in the path', () => {
    expect(normalizeUrl('https://example.com/a//b///c')).toBe('https://example.com/a/b/c');
  });

  it('decodes unreserved percent-encodings and uppercases the rest', () => {
    expect(normalizeUrl('https://example.com/%7Euser/%61%2f')).toBe(
      'https://example.com/~user/a%2F',
    );
  });

  it('sorts query params alphabetically and stably', () => {
    expect(normalizeUrl('https://example.com/?b=2&a=1&b=1')).toBe(
      'https://example.com/?a=1&b=2&b=1',
    );
  });

  it('drops params listed in stripParams', () => {
    expect(
      normalizeUrl('https://example.com/?utm_source=x&q=1&utm_medium=y', undefined, {
        stripParams: ['utm_source', 'utm_medium'],
      }),
    ).toBe('https://example.com/?q=1');
  });

  it('removes the ? when stripping leaves no params', () => {
    expect(
      normalizeUrl('https://example.com/page?utm_source=x', undefined, {
        stripParams: ['utm_source'],
      }),
    ).toBe('https://example.com/page');
  });

  it('drops the whole query with stripQuery', () => {
    expect(normalizeUrl('https://example.com/a?x=1&y=2', undefined, { stripQuery: true })).toBe(
      'https://example.com/a',
    );
  });

  it('resolves relative URLs against a base', () => {
    expect(normalizeUrl('../up', 'https://example.com/a/b/c')).toBe('https://example.com/a/up');
    expect(normalizeUrl('/rooted', 'https://example.com/a/b')).toBe('https://example.com/rooted');
  });

  it('returns null for unparseable input', () => {
    expect(normalizeUrl('http://')).toBeNull();
    expect(normalizeUrl('not a url')).toBeNull();
    expect(normalizeUrl('relative/no-base')).toBeNull();
  });

  it('returns null for non-http(s) schemes', () => {
    expect(normalizeUrl('ftp://example.com/file')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('mailto:a@example.com')).toBeNull();
    expect(normalizeUrl('file:///etc/passwd')).toBeNull();
  });

  it('is idempotent', () => {
    const once = normalizeUrl('HTTP://Example.com:80/a/../b//c?z=1&a=2#f');
    expect(once).not.toBeNull();
    expect(normalizeUrl(once as string)).toBe(once);
  });
});

describe('urlHash', () => {
  it('returns the sha256 digest as a Buffer', () => {
    const hash = urlHash('https://example.com/');
    expect(Buffer.isBuffer(hash)).toBe(true);
    expect(hash.length).toBe(32);
    // Known vector: sha256('https://example.com/')
    expect(hash.toString('hex')).toBe(
      '0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7',
    );
  });

  it('differs for different URLs', () => {
    expect(urlHash('https://example.com/a').equals(urlHash('https://example.com/b'))).toBe(false);
  });
});

describe('registrableDomain', () => {
  it('returns the last two labels for generic TLDs', () => {
    expect(registrableDomain('example.com')).toBe('example.com');
    expect(registrableDomain('www.example.com')).toBe('example.com');
    expect(registrableDomain('a.b.deep.example.com')).toBe('example.com');
  });

  it('takes three labels for well-known second-level suffixes', () => {
    expect(registrableDomain('www.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('shop.example.com.au')).toBe('example.com.au');
    expect(registrableDomain('cars.cardekho.co.in')).toBe('cardekho.co.in');
    expect(registrableDomain('portal.example.gov.in')).toBe('example.gov.in');
    expect(registrableDomain('www.example.ac.jp')).toBe('example.ac.jp');
  });

  it('lowercases and strips a trailing dot', () => {
    expect(registrableDomain('WWW.Example.COM.')).toBe('example.com');
  });

  it('passes through single labels and IP literals', () => {
    expect(registrableDomain('localhost')).toBe('localhost');
    expect(registrableDomain('127.0.0.1')).toBe('127.0.0.1');
    expect(registrableDomain('[::1]')).toBe('[::1]');
  });
});
