import { UrlFilter } from './url-filter';

describe('UrlFilter.isInScope', () => {
  it('accepts the origin host and its subdomains (same registrable domain)', () => {
    const filter = new UrlFilter({ origin: 'https://example.com' });
    expect(filter.isInScope('https://example.com/')).toBe(true);
    expect(filter.isInScope('https://example.com/deep/page?q=1')).toBe(true);
    expect(filter.isInScope('https://blog.example.com/post')).toBe(true);
    expect(filter.isInScope('http://example.com/')).toBe(true); // scheme is not a scope signal
  });

  it('rejects other registrable domains', () => {
    const filter = new UrlFilter({ origin: 'https://example.com' });
    expect(filter.isInScope('https://other.com/')).toBe(false);
    expect(filter.isInScope('https://example.org/')).toBe(false);
    expect(filter.isInScope('https://notexample.com/')).toBe(false);
  });

  it('rejects unparseable and non-http URLs', () => {
    const filter = new UrlFilter({ origin: 'https://example.com' });
    expect(filter.isInScope('not a url')).toBe(false);
    expect(filter.isInScope('ftp://example.com/x')).toBe(false);
    expect(filter.isInScope('javascript:alert(1)')).toBe(false);
  });

  it('accepts an origin given with a path and ignores that path for domain scope', () => {
    const filter = new UrlFilter({ origin: 'https://example.com/some/page' });
    expect(filter.isInScope('https://example.com/other')).toBe(true);
  });

  it('enforces pathScope on segment boundaries', () => {
    const filter = new UrlFilter({ origin: 'https://example.com', pathScope: '/blog' });
    expect(filter.isInScope('https://example.com/blog')).toBe(true);
    expect(filter.isInScope('https://example.com/blog/post-1')).toBe(true);
    expect(filter.isInScope('https://example.com/blogger')).toBe(false);
    expect(filter.isInScope('https://example.com/')).toBe(false);
  });

  it('handles pathScope with a trailing slash', () => {
    const filter = new UrlFilter({ origin: 'https://example.com', pathScope: '/blog/' });
    expect(filter.isInScope('https://example.com/blog')).toBe(true);
    expect(filter.isInScope('https://example.com/blog/post')).toBe(true);
    expect(filter.isInScope('https://example.com/blogger')).toBe(false);
  });
});

describe('UrlFilter.isAllowed', () => {
  it('allows everything when no globs are configured', () => {
    const filter = new UrlFilter({ origin: 'https://example.com' });
    expect(filter.isAllowed('https://example.com/anything/at/all')).toBe(true);
  });

  it('restricts to allow globs when provided', () => {
    const filter = new UrlFilter({
      origin: 'https://example.com',
      allow: ['/products/**', '/about'],
    });
    expect(filter.isAllowed('https://example.com/products/x/y')).toBe(true);
    expect(filter.isAllowed('https://example.com/about')).toBe(true);
    expect(filter.isAllowed('https://example.com/contact')).toBe(false);
  });

  it('single * does not cross path segments; ** does', () => {
    const filter = new UrlFilter({ origin: 'https://example.com', allow: ['/p/*'] });
    expect(filter.isAllowed('https://example.com/p/one')).toBe(true);
    expect(filter.isAllowed('https://example.com/p/one/two')).toBe(false);

    const deep = new UrlFilter({ origin: 'https://example.com', allow: ['/p/**'] });
    expect(deep.isAllowed('https://example.com/p/one/two')).toBe(true);
  });

  it('? matches exactly one non-slash character', () => {
    const filter = new UrlFilter({ origin: 'https://example.com', allow: ['/page-?'] });
    expect(filter.isAllowed('https://example.com/page-1')).toBe(true);
    expect(filter.isAllowed('https://example.com/page-12')).toBe(false);
    expect(filter.isAllowed('https://example.com/page-/')).toBe(false);
  });

  it('block wins over allow', () => {
    const filter = new UrlFilter({
      origin: 'https://example.com',
      allow: ['/docs/**'],
      block: ['/docs/private/**'],
    });
    expect(filter.isAllowed('https://example.com/docs/guide')).toBe(true);
    expect(filter.isAllowed('https://example.com/docs/private/secret')).toBe(false);
  });

  it('matches extension-style globs anywhere', () => {
    const filter = new UrlFilter({ origin: 'https://example.com', block: ['**/*.pdf'] });
    expect(filter.isAllowed('https://example.com/file.pdf')).toBe(false);
    expect(filter.isAllowed('https://example.com/deep/dir/file.pdf')).toBe(false);
    expect(filter.isAllowed('https://example.com/file.html')).toBe(true);
  });

  it('escapes regex metacharacters in globs', () => {
    const filter = new UrlFilter({ origin: 'https://example.com', allow: ['/a+b(c)'] });
    expect(filter.isAllowed('https://example.com/a+b(c)')).toBe(true);
    expect(filter.isAllowed('https://example.com/aab(c)')).toBe(false);
  });
});

describe('UrlFilter.classify', () => {
  const filter = new UrlFilter({
    origin: 'https://example.com',
    pathScope: '/shop',
    block: ['**/*.pdf'],
  });

  it('labels an in-scope, allowed URL', () => {
    expect(filter.classify('https://example.com/shop/item')).toBe('in_scope');
    expect(filter.classify('https://cdn.example.com/shop/item')).toBe('in_scope');
  });

  it('labels a foreign-domain or out-of-path URL out_of_scope', () => {
    expect(filter.classify('https://other.com/shop/item')).toBe('out_of_scope');
    expect(filter.classify('https://example.com/blog/item')).toBe('out_of_scope');
    expect(filter.classify('not a url')).toBe('out_of_scope');
  });

  it('labels an in-scope but blocked URL blocked', () => {
    expect(filter.classify('https://example.com/shop/manual.pdf')).toBe('blocked');
  });

  it('out_of_scope takes precedence over blocked', () => {
    expect(filter.classify('https://other.com/shop/manual.pdf')).toBe('out_of_scope');
  });
});

describe('UrlFilter constructor', () => {
  it('throws on an unparseable origin (programmer error)', () => {
    expect(() => new UrlFilter({ origin: 'not-a-url' })).toThrow();
  });
});
