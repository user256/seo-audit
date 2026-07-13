import { describe, expect, it } from 'vitest';
import { compareHreflangSources } from './compare-sources';
import { normalizeHreflangUrl } from './normalize-url';
import { validateHreflangTag } from './validate-tag';

describe('validateHreflangTag', () => {
  it('accepts language-only tags', () => {
    expect(validateHreflangTag('en')).toEqual({ valid: true });
    expect(validateHreflangTag('fr')).toEqual({ valid: true });
  });

  it('accepts language-region tags', () => {
    expect(validateHreflangTag('en-gb')).toEqual({ valid: true });
    expect(validateHreflangTag('pt-br')).toEqual({ valid: true });
  });

  it('accepts x-default', () => {
    expect(validateHreflangTag('x-default')).toEqual({ valid: true });
  });

  it('flags invalid language codes', () => {
    const result = validateHreflangTag('xx');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/not a valid ISO 639-1/);
    }
  });

  it('suggests common typos without treating them as valid', () => {
    const result = validateHreflangTag('en-uk');
    expect(result).toEqual({
      valid: false,
      reason: '"en-uk" looks like a typo — did you mean "en-gb"?',
      typo: 'en-gb',
    });
  });
});

describe('normalizeHreflangUrl', () => {
  it('strips trailing slashes from the path', () => {
    expect(normalizeHreflangUrl('https://example.com/page/')).toBe('https://example.com/page');
    expect(normalizeHreflangUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('retains origin, path, and search', () => {
    expect(normalizeHreflangUrl('https://example.com/path?q=1#hash')).toBe(
      'https://example.com/path?q=1',
    );
  });
});

describe('compareHreflangSources', () => {
  it('reports mismatches between captured HTML and sitemap targets', () => {
    const mismatches = compareHreflangSources(
      [{ hreflang: 'de', href: 'https://example.com/de/page' }],
      [{ hreflang: 'de', href: 'https://example.com/de/seite' }],
    );
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.hreflang).toBe('de');
  });

  it('ignores hreflang codes present in only one source', () => {
    expect(
      compareHreflangSources(
        [{ hreflang: 'en', href: 'https://example.com/en' }],
        [{ hreflang: 'de', href: 'https://example.com/de' }],
      ),
    ).toEqual([]);
  });

  it('treats trailing-slash variants as equal', () => {
    expect(
      compareHreflangSources(
        [{ hreflang: 'en', href: 'https://example.com/en/' }],
        [{ hreflang: 'en', href: 'https://example.com/en' }],
      ),
    ).toEqual([]);
  });
});
