import { CHECKS, getCheck } from './checks';
import { CATALOG_CHECKS, CHECK_IDS, CROSS_PAGE_CHECKS, getCatalogCheck } from './catalog';
import { ENGINE_VERSION } from './version';

describe('per-page check catalog', () => {
  it('has unique ids in category.subject.condition format', () => {
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const check of CHECKS) {
      expect(check.id).toMatch(/^[a-z]+(\.[a-z0-9_]+)+$/);
    }
  });

  it('every check has complete copy and a positive weight', () => {
    for (const check of CHECKS) {
      expect(check.name.trim().length).toBeGreaterThan(0);
      expect(check.description.trim().length).toBeGreaterThan(0);
      expect(check.technicalExplanation.trim().length).toBeGreaterThan(0);
      expect(check.suggestedFix.trim().length).toBeGreaterThan(0);
      expect(check.weight).toBeGreaterThan(0);
    }
  });

  it('getCheck resolves known ids and rejects unknown', () => {
    expect(getCheck('meta.title.missing')?.id).toBe('meta.title.missing');
    expect(getCheck('does.not.exist')).toBeUndefined();
  });

  it('covers all six categories', () => {
    const categories = new Set(CHECKS.map((c) => c.category));
    expect([...categories].sort()).toEqual([
      'headings',
      'images',
      'links',
      'meta',
      'social',
      'technical',
    ]);
  });
});

describe('unified catalog (single source of truth)', () => {
  it('includes per-page, cross-page and runtime checks with unique ids', () => {
    const ids = CATALOG_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    // per-page + 3 finalizer-only duplicate checks + 2 runtime checks.
    expect(ids.length).toBe(CHECKS.length + CROSS_PAGE_CHECKS.length + 2);
    expect(CROSS_PAGE_CHECKS.length).toBe(3);
  });

  it('exposes every emitted check id, and each resolves in the catalog', () => {
    for (const id of Object.values(CHECK_IDS)) {
      expect(getCatalogCheck(id)).toBeDefined();
    }
  });

  it('broken-link ids reuse the per-page checks (same finding)', () => {
    expect(getCheck(CHECK_IDS.LINK_INTERNAL_BROKEN)).toBeDefined();
    expect(getCheck(CHECK_IDS.LINK_EXTERNAL_BROKEN)).toBeDefined();
  });

  it('finalizer-only duplicate ids are present', () => {
    const ids = CROSS_PAGE_CHECKS.map((c) => c.id);
    expect(ids).toEqual([
      CHECK_IDS.DUPLICATE_TITLE,
      CHECK_IDS.DUPLICATE_DESCRIPTION,
      CHECK_IDS.DUPLICATE_H1,
    ]);
  });

  it('every catalog entry has complete copy, category and positive weight', () => {
    for (const meta of CATALOG_CHECKS) {
      expect(meta.name.trim().length).toBeGreaterThan(0);
      expect(meta.description.trim().length).toBeGreaterThan(0);
      expect(meta.technicalExplanation.trim().length).toBeGreaterThan(0);
      expect(meta.businessImpact.trim().length).toBeGreaterThan(0);
      expect(meta.suggestedFix.trim().length).toBeGreaterThan(0);
      expect(meta.category.length).toBeGreaterThan(0);
      expect(meta.weight).toBeGreaterThan(0);
    }
  });
});

describe('engine version', () => {
  it('is exported', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
