import { describe, expect, it } from 'vitest';
import { generateVariants } from './generate-variants';
import { DEFAULT_VARIANT_KIND_OPTIONS, type VariantKindOptions } from './types';

const ALL_KINDS: VariantKindOptions = {
  scheme: true,
  www: true,
  trailingSlash: true,
  case: true,
  indexFilenames: true,
};

describe('generateVariants', () => {
  it('rejects non-http(s) schemes', () => {
    const result = generateVariants('file:///tmp/page.html', DEFAULT_VARIANT_KIND_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('unsupported-scheme');
    }
  });

  it('rejects unparseable URLs', () => {
    const result = generateVariants('not-a-url', DEFAULT_VARIANT_KIND_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid-url');
    }
  });

  it('always includes the normalized base URL', () => {
    const result = generateVariants('https://example.com/path', {
      scheme: false,
      www: false,
      trailingSlash: false,
      case: false,
      indexFilenames: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variants).toEqual([
        { url: 'https://example.com/path', kind: 'base', label: 'Base URL' },
      ]);
    }
  });

  it('deduplicates overlapping scheme and www variants', () => {
    const result = generateVariants('https://www.example.com/', ALL_KINDS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const urls = result.variants.map((variant) => variant.url);
      expect(new Set(urls).size).toBe(urls.length);
      expect(urls).toContain('http://www.example.com/');
      expect(urls).toContain('https://example.com/');
    }
  });

  it('generates trailing slash and index filename variants', () => {
    const result = generateVariants('https://example.com/dir/page', {
      ...DEFAULT_VARIANT_KIND_OPTIONS,
      scheme: false,
      www: false,
      case: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const urls = result.variants.map((variant) => variant.url);
      expect(urls).toContain('https://example.com/dir/page/');
      expect(urls).toContain('https://example.com/dir/page/index.html');
    }
  });

  it('skips www variants for localhost', () => {
    const result = generateVariants('https://localhost:8080/app', {
      scheme: false,
      www: true,
      trailingSlash: false,
      case: false,
      indexFilenames: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variants.every((variant) => !variant.url.includes('www.'))).toBe(true);
    }
  });
});
