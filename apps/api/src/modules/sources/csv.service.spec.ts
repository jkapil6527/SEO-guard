import { BadRequestException } from '@nestjs/common';
import { CsvService, isHttpUrl } from './csv.service';

describe('CsvService.validateUrlCsv', () => {
  const service = new CsvService();

  it('accepts a well-formed URL CSV and reports counts', async () => {
    const csv = Buffer.from(
      'url,priority\nhttps://example.com/a,1\nhttps://example.com/b,2\nhttps://example.com/c,3\n',
    );
    const result = await service.validateUrlCsv(csv, 'url');
    expect(result).toMatchObject({ rowCount: 3, validUrlCount: 3, urlColumn: 'url' });
  });

  it('supports a custom URL column', async () => {
    const csv = Buffer.from('page_url\nhttps://example.com/x\n');
    const result = await service.validateUrlCsv(csv, 'page_url');
    expect(result.validUrlCount).toBe(1);
  });

  it('rejects a CSV missing the URL column, naming the columns it found', async () => {
    const csv = Buffer.from('link,priority\nhttps://example.com/a,1\n');
    await expect(service.validateUrlCsv(csv, 'url')).rejects.toMatchObject({
      response: { code: 'CSV_INVALID' },
    });
  });

  it('rejects an empty file and a header-only file', async () => {
    await expect(service.validateUrlCsv(Buffer.alloc(0), 'url')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.validateUrlCsv(Buffer.from('url\n'), 'url')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects binary content masquerading as CSV', async () => {
    const binary = Buffer.concat([Buffer.from('url\n'), Buffer.from([0x00, 0x01, 0x02])]);
    await expect(service.validateUrlCsv(binary, 'url')).rejects.toMatchObject({
      response: { code: 'CSV_INVALID' },
    });
  });

  it('rejects when more than 5% of rows have invalid URLs', async () => {
    const rows = ['url'];
    for (let i = 0; i < 90; i++) rows.push(`https://example.com/${i}`);
    for (let i = 0; i < 10; i++) rows.push('not-a-url');
    await expect(service.validateUrlCsv(Buffer.from(rows.join('\n')), 'url')).rejects.toMatchObject(
      { response: { code: 'CSV_INVALID' } },
    );
  });

  it('tolerates a small fraction of invalid rows', async () => {
    const rows = ['url'];
    for (let i = 0; i < 99; i++) rows.push(`https://example.com/${i}`);
    rows.push('not-a-url');
    const result = await service.validateUrlCsv(Buffer.from(rows.join('\n')), 'url');
    expect(result.rowCount).toBe(100);
    expect(result.validUrlCount).toBe(99);
  });
});

describe('isHttpUrl', () => {
  it.each([
    ['https://example.com/path?q=1', true],
    ['http://example.com', true],
    ['ftp://example.com', false],
    ['javascript:alert(1)', false],
    ['//example.com', false],
    ['', false],
    ['not a url', false],
  ])('%s → %s', (value, expected) => {
    expect(isHttpUrl(value)).toBe(expected);
  });
});
