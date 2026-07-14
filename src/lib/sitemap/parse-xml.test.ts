import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parseSitemapXml, sanitizeSitemapXml } from './parse-xml';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

describe('sanitizeSitemapXml', () => {
  it('rejects DOCTYPE declarations', () => {
    const result = sanitizeSitemapXml('<!DOCTYPE foo [<!ENTITY xxe "bad">]><urlset/>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/DOCTYPE/i);
  });

  it('rejects unknown entity references', () => {
    const result = sanitizeSitemapXml('<urlset>&xxe;</urlset>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Unsafe XML entity/);
  });

  it('allows predefined XML entities', () => {
    const result = sanitizeSitemapXml('<urlset>&amp;&lt;</urlset>');
    expect(result.ok).toBe(true);
  });
});

describe('parseSitemapXml', () => {
  it('parses a basic urlset with loc metadata', () => {
    const result = parseSitemapXml(fixture('urlset-basic.xml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isIndex).toBe(false);
    expect(result.kind).toBe('urlset');
    expect(result.entries.size).toBe(2);

    const pageA = result.entries.get('https://example.com/page-a');
    expect(pageA).toMatchObject({
      loc: 'https://example.com/page-a',
      lastmod: '2026-07-01',
      changefreq: 'weekly',
      priority: '0.8',
      alternates: [],
    });
    expect(pageA?.locRaw).toContain('page-a');
  });

  it('parses hreflang alternates with namespace prefixes', () => {
    const result = parseSitemapXml(fixture('urlset-hreflang.xml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = result.entries.get('https://example.com/en/page');
    expect(entry?.alternates).toHaveLength(3);
    expect(entry?.alternates[0]).toMatchObject({
      hreflang: 'en',
      href: 'https://example.com/en/page',
      rel: 'alternate',
    });
    expect(entry?.alternates[0]?.rawAttributes).toMatchObject({
      rel: 'alternate',
      hreflang: 'en',
      href: 'https://example.com/en/page',
    });
    expect(entry?.alternates.map((a) => a.hreflang)).toEqual(['en', 'de', 'x-default']);
  });

  it('parses a sitemapindex and records child locs', () => {
    const result = parseSitemapXml(fixture('sitemap-index.xml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isIndex).toBe(true);
    expect(result.kind).toBe('sitemapindex');
    expect(result.entries.size).toBe(0);
    expect(result.childSitemaps).toHaveLength(2);
    expect(result.childSitemaps[0]).toMatchObject({
      loc: 'https://example.com/sitemap-pages.xml',
      lastmod: '2026-07-01',
    });
    expect(result.childSitemaps[1]?.loc).toBe('https://cdn.example.com/sitemap-images.xml');
  });

  it('reports diagnostics for malformed url entries', () => {
    const result = parseSitemapXml(fixture('malformed.xml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries.size).toBe(1);
    expect(result.diagnostics.some((d) => d.includes('missing <loc>'))).toBe(true);
  });

  it('fails on severely malformed XML', () => {
    const result = parseSitemapXml('<urlset><url><loc>unclosed');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Malformed/i);
  });

  it('fails when the root element is unexpected', () => {
    const result = parseSitemapXml('<feed><entry/></feed>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/urlset or sitemapindex/);
  });

  it('parses fixtures when DOMParser is unavailable (service worker path)', () => {
    vi.stubGlobal('DOMParser', undefined);
    try {
      for (const name of [
        'urlset-basic.xml',
        'urlset-hreflang.xml',
        'sitemap-index.xml',
        'malformed.xml',
      ]) {
        const result = parseSitemapXml(fixture(name));
        expect(result.ok, `fixture ${name}: ${!result.ok ? result.error : ''}`).toBe(true);
      }

      const hreflang = parseSitemapXml(fixture('urlset-hreflang.xml'));
      if (!hreflang.ok) return;
      const entry = hreflang.entries.get('https://example.com/en/page');
      expect(entry?.alternates.map((a) => a.hreflang)).toEqual(['en', 'de', 'x-default']);

      const bad = parseSitemapXml('<urlset><url><loc>unclosed');
      expect(bad.ok).toBe(false);
      if (bad.ok) return;
      expect(bad.error).toMatch(/Malformed/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('truncates when entry count exceeds the limit', () => {
    const maxEntries = 5;
    const urls = Array.from(
      { length: maxEntries + 3 },
      (_, i) => `<url><loc>https://example.com/p${i}</loc></url>`,
    ).join('');
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
    const result = parseSitemapXml(xml, { limits: { maxEntries } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.truncated).toBe(true);
    expect(result.entries.size).toBe(maxEntries);
  });
});
