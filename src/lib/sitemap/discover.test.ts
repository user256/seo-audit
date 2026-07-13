import { describe, expect, it } from 'vitest';
import { COMMON_SITEMAP_PATHS, discoverSitemapCandidates } from './discover';

describe('discoverSitemapCandidates', () => {
  it('includes robots sitemap directives first', () => {
    const candidates = discoverSitemapCandidates({
      origin: 'https://example.com',
      robotsSitemaps: ['https://example.com/custom-sitemap.xml'],
    });

    expect(candidates[0]).toEqual({
      url: 'https://example.com/custom-sitemap.xml',
      source: 'robots',
    });
  });

  it('adds common same-origin paths', () => {
    const candidates = discoverSitemapCandidates({
      origin: 'https://example.com',
    });

    const common = candidates.filter((c) => c.source === 'common-path');
    expect(common.map((c) => c.url)).toEqual(
      COMMON_SITEMAP_PATHS.map((p) => `https://example.com${p}`),
    );
  });

  it('deduplicates robots and common-path overlaps', () => {
    const candidates = discoverSitemapCandidates({
      origin: 'https://example.com',
      robotsSitemaps: ['https://example.com/sitemap.xml'],
    });

    const sitemapXml = candidates.filter((c) => c.url === 'https://example.com/sitemap.xml');
    expect(sitemapXml).toHaveLength(1);
    expect(sitemapXml[0]?.source).toBe('robots');
  });

  it('includes pasted manual URLs', () => {
    const candidates = discoverSitemapCandidates({
      origin: 'https://example.com',
      pastedUrls: ['https://other.example/sitemap.xml', 'not-a-url'],
    });

    expect(candidates.some((c) => c.source === 'manual' && c.url.includes('other.example'))).toBe(
      true,
    );
    expect(candidates.some((c) => c.url === 'not-a-url')).toBe(false);
  });
});
