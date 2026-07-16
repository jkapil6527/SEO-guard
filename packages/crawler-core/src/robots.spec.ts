import { parseRobots } from './robots';

const BOT = 'SEOGuardianBot/1.0 (+https://seo-guardian.example)';

describe('parseRobots', () => {
  it('allows everything when robots.txt is empty or has no groups', () => {
    expect(parseRobots('').isAllowed('https://example.com/x', BOT)).toBe(true);
    expect(parseRobots('# only comments\n\n').isAllowed('https://example.com/x', BOT)).toBe(true);
  });

  it('applies simple disallow rules from the * group', () => {
    const rules = parseRobots(['User-agent: *', 'Disallow: /private/'].join('\n'));
    expect(rules.isAllowed('https://example.com/private/page', BOT)).toBe(false);
    expect(rules.isAllowed('https://example.com/public/page', BOT)).toBe(true);
  });

  it('treats an empty Disallow as allow-all for the group', () => {
    const rules = parseRobots(['User-agent: *', 'Disallow:'].join('\n'));
    expect(rules.isAllowed('https://example.com/anything', BOT)).toBe(true);
  });

  it('longest match wins between Allow and Disallow', () => {
    const rules = parseRobots(
      ['User-agent: *', 'Disallow: /shop/', 'Allow: /shop/sale/'].join('\n'),
    );
    expect(rules.isAllowed('https://example.com/shop/item', BOT)).toBe(false);
    expect(rules.isAllowed('https://example.com/shop/sale/item', BOT)).toBe(true);
  });

  it('Allow wins on a tie of equal pattern lengths', () => {
    const rules = parseRobots(['User-agent: *', 'Disallow: /page', 'Allow: /page'].join('\n'));
    expect(rules.isAllowed('https://example.com/page', BOT)).toBe(true);
  });

  it('supports * wildcards inside patterns', () => {
    const rules = parseRobots(['User-agent: *', 'Disallow: /*/print'].join('\n'));
    expect(rules.isAllowed('https://example.com/article/print', BOT)).toBe(false);
    expect(rules.isAllowed('https://example.com/article/view', BOT)).toBe(true);
  });

  it('supports the $ end anchor', () => {
    const rules = parseRobots(['User-agent: *', 'Disallow: /*.pdf$'].join('\n'));
    expect(rules.isAllowed('https://example.com/doc.pdf', BOT)).toBe(false);
    expect(rules.isAllowed('https://example.com/doc.pdf?download=1', BOT)).toBe(true);
    expect(rules.isAllowed('https://example.com/doc.pdfx', BOT)).toBe(true);
  });

  it('matches against path plus query', () => {
    const rules = parseRobots(['User-agent: *', 'Disallow: /*?*sessionid='].join('\n'));
    expect(rules.isAllowed('https://example.com/page?sessionid=abc', BOT)).toBe(false);
    expect(rules.isAllowed('https://example.com/page?id=1', BOT)).toBe(true);
  });

  it('prefers the most specific user-agent group over *', () => {
    const rules = parseRobots(
      [
        'User-agent: *',
        'Disallow: /generic/',
        '',
        'User-agent: seoguardianbot',
        'Disallow: /bot-only/',
      ].join('\n'),
    );
    // The specific group replaces the * group entirely.
    expect(rules.isAllowed('https://example.com/generic/x', BOT)).toBe(true);
    expect(rules.isAllowed('https://example.com/bot-only/x', BOT)).toBe(false);
  });

  it('user-agent matching is case-insensitive substring', () => {
    const rules = parseRobots(['User-agent: SEOGuardianBot', 'Disallow: /'].join('\n'));
    expect(rules.isAllowed('https://example.com/', 'Mozilla-compatible seoguardianbot v2')).toBe(
      false,
    );
    expect(rules.isAllowed('https://example.com/', 'OtherBot')).toBe(true);
  });

  it('picks the longest matching user-agent token', () => {
    const rules = parseRobots(
      [
        'User-agent: seo',
        'Disallow: /short/',
        '',
        'User-agent: seoguardian',
        'Disallow: /long/',
      ].join('\n'),
    );
    expect(rules.isAllowed('https://example.com/long/x', BOT)).toBe(false);
    expect(rules.isAllowed('https://example.com/short/x', BOT)).toBe(true);
  });

  it('supports multiple user-agent lines heading one group', () => {
    const rules = parseRobots(
      ['User-agent: alphabot', 'User-agent: seoguardianbot', 'Disallow: /shared/'].join('\n'),
    );
    expect(rules.isAllowed('https://example.com/shared/x', BOT)).toBe(false);
    expect(rules.isAllowed('https://example.com/shared/x', 'alphabot')).toBe(false);
    expect(rules.isAllowed('https://example.com/shared/x', 'unrelated')).toBe(true);
  });

  it('merges multiple groups for the same user agent', () => {
    const rules = parseRobots(
      ['User-agent: *', 'Disallow: /a/', '', 'User-agent: *', 'Disallow: /b/'].join('\n'),
    );
    expect(rules.isAllowed('https://example.com/a/x', BOT)).toBe(false);
    expect(rules.isAllowed('https://example.com/b/x', BOT)).toBe(false);
  });

  it('ignores rules that appear before any user-agent line', () => {
    const rules = parseRobots(
      ['Disallow: /orphan/', 'User-agent: *', 'Disallow: /real/'].join('\n'),
    );
    expect(rules.isAllowed('https://example.com/orphan/x', BOT)).toBe(true);
    expect(rules.isAllowed('https://example.com/real/x', BOT)).toBe(false);
  });

  it('strips comments and tolerates CRLF and a BOM', () => {
    const rules = parseRobots('\uFEFFUser-agent: * # everyone\r\nDisallow: /hidden/ # comment\r\n');
    expect(rules.isAllowed('https://example.com/hidden/x', BOT)).toBe(false);
  });

  it('exposes crawl-delay in milliseconds for the matching group', () => {
    const rules = parseRobots(
      [
        'User-agent: *',
        'Crawl-delay: 2',
        '',
        'User-agent: seoguardianbot',
        'Crawl-delay: 0.5',
      ].join('\n'),
    );
    expect(rules.crawlDelayMs(BOT)).toBe(500);
    expect(rules.crawlDelayMs('otherbot')).toBe(2000);
  });

  it('returns null crawl delay when absent or invalid', () => {
    const rules = parseRobots(['User-agent: *', 'Crawl-delay: soon', 'Disallow: /x'].join('\n'));
    expect(rules.crawlDelayMs(BOT)).toBeNull();
    expect(parseRobots('').crawlDelayMs(BOT)).toBeNull();
  });

  it('collects absolute sitemap URLs from anywhere in the file', () => {
    const rules = parseRobots(
      [
        'Sitemap: https://example.com/sitemap.xml',
        'User-agent: *',
        'Disallow: /x',
        'Sitemap: https://cdn.example.com/sitemap-2.xml.gz',
        'Sitemap: /relative/ignored.xml',
      ].join('\n'),
    );
    expect(rules.sitemaps).toEqual([
      'https://example.com/sitemap.xml',
      'https://cdn.example.com/sitemap-2.xml.gz',
    ]);
  });

  it('accepts path-only input to isAllowed', () => {
    const rules = parseRobots(['User-agent: *', 'Disallow: /private/'].join('\n'));
    expect(rules.isAllowed('/private/x', BOT)).toBe(false);
    expect(rules.isAllowed('/public/x', BOT)).toBe(true);
  });
});
