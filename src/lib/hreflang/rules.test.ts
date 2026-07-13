import { describe, expect, it } from 'vitest';
import type { Evidence, PageSnapshot } from '../schemas/audit';
import { evaluatePageSnapshot } from '../rules/engine';
import { ALTERNATES_SOURCE, SITEMAP_HREFLANG_SOURCE } from './rules';

const FIXED_TIME = '2026-07-13T12:00:00.000Z';
const PAGE_URL = 'https://example.com/en/page';

function alternatesEvidence(
  alternates: Array<{ hreflang: string; href: string; absolute?: string | null }>,
): Evidence {
  return {
    id: 'ev-alternates',
    kind: 'dom',
    source: ALTERNATES_SOURCE,
    capturedAt: FIXED_TIME,
    value: {
      state: 'present',
      selector: 'link[rel=alternate][hreflang]',
      value: alternates.map((alt, index) => ({
        hreflang: alt.hreflang,
        href: alt.href,
        absolute: alt.absolute === undefined ? alt.href : alt.absolute,
        selector: `link[rel=alternate][hreflang]:nth-of-type(${index + 1})`,
      })),
    },
  };
}

function sitemapEvidence(
  alternates: Array<{ hreflang: string; href: string }>,
  loc = PAGE_URL,
): Evidence {
  return {
    id: 'ev-sitemap-hreflang',
    kind: 'sitemap',
    source: SITEMAP_HREFLANG_SOURCE,
    capturedAt: FIXED_TIME,
    value: { loc, alternates },
  };
}

function snapshot(evidence: Evidence[]): PageSnapshot {
  return {
    id: 'snap-hreflang',
    url: PAGE_URL,
    capturedAt: FIXED_TIME,
    evidence,
  };
}

function ruleIds(snapshot: PageSnapshot): string[] {
  return evaluatePageSnapshot(snapshot, {
    checkIds: new Set(['hreflang-directive-validation']),
  }).findings.map((finding) => finding.ruleId);
}

describe('hreflang directive validation fixtures', () => {
  it('accepts language-only alternates', () => {
    expect(
      ruleIds(
        snapshot([
          alternatesEvidence([
            { hreflang: 'en', href: 'https://example.com/en/page' },
            { hreflang: 'de', href: 'https://example.com/de/seite' },
          ]),
        ]),
      ),
    ).toEqual([]);
  });

  it('accepts language-region alternates', () => {
    expect(
      ruleIds(
        snapshot([
          alternatesEvidence([
            { hreflang: 'en-gb', href: 'https://example.com/en-gb/page' },
            { hreflang: 'en-us', href: 'https://example.com/en-us/page' },
          ]),
        ]),
      ),
    ).toEqual([]);
  });

  it('accepts x-default', () => {
    expect(
      ruleIds(
        snapshot([
          alternatesEvidence([
            { hreflang: 'en', href: 'https://example.com/en/page' },
            { hreflang: 'x-default', href: 'https://example.com/en/page' },
          ]),
        ]),
      ),
    ).toEqual([]);
  });

  it('flags invalid language codes', () => {
    expect(
      ruleIds(
        snapshot([alternatesEvidence([{ hreflang: 'xx', href: 'https://example.com/xx/page' }])]),
      ),
    ).toContain('hreflang-invalid-language');
  });

  it('flags likely typos separately from invalid codes', () => {
    expect(
      ruleIds(
        snapshot([
          alternatesEvidence([{ hreflang: 'en-uk', href: 'https://example.com/en-gb/page' }]),
        ]),
      ),
    ).toContain('hreflang-likely-typo');
  });

  it('flags duplicate hreflang values within HTML', () => {
    expect(
      ruleIds(
        snapshot([
          alternatesEvidence([
            { hreflang: 'en', href: 'https://example.com/en/page' },
            { hreflang: 'en', href: 'https://example.com/en/other' },
          ]),
        ]),
      ),
    ).toContain('hreflang-duplicate-alternate');
  });

  it('flags empty href targets', () => {
    expect(
      ruleIds(
        snapshot([
          alternatesEvidence([
            { hreflang: 'de', href: '', absolute: 'https://example.com/en/page' },
          ]),
        ]),
      ),
    ).toContain('hreflang-empty-href');
  });

  it('warns on relative HTML hrefs', () => {
    expect(
      ruleIds(
        snapshot([
          alternatesEvidence([
            { hreflang: 'de', href: '/de/seite', absolute: 'https://example.com/de/seite' },
          ]),
        ]),
      ),
    ).toContain('hreflang-relative-url');
  });

  it('validates sitemap-only alternates when HTML is absent', () => {
    expect(
      ruleIds(
        snapshot([
          sitemapEvidence([
            { hreflang: 'en', href: 'https://example.com/en/page' },
            { hreflang: 'xx', href: 'https://example.com/xx/page' },
          ]),
        ]),
      ),
    ).toContain('hreflang-invalid-language');
  });

  it('reports HTML/sitemap mismatches as partial captured evidence', () => {
    const { findings } = evaluatePageSnapshot(
      snapshot([
        alternatesEvidence([
          { hreflang: 'en', href: 'https://example.com/en/page' },
          { hreflang: 'de', href: 'https://example.com/de/page' },
        ]),
        sitemapEvidence([
          { hreflang: 'en', href: 'https://example.com/en/page' },
          { hreflang: 'de', href: 'https://example.com/de/seite' },
        ]),
      ]),
      { checkIds: new Set(['hreflang-directive-validation']) },
    );
    const mismatch = findings.find(
      (finding) => finding.ruleId === 'hreflang-html-sitemap-mismatch',
    );
    expect(mismatch).toBeDefined();
    expect(mismatch?.description).toMatch(/Among captured evidence/);
    expect(mismatch?.description).toMatch(/not live reciprocity/);
    expect(mismatch?.evidenceIds).toEqual(['ev-alternates', 'ev-sitemap-hreflang']);
  });

  it('does not compare HTML to sitemap when sitemap alternates are missing', () => {
    expect(
      ruleIds(
        snapshot([
          alternatesEvidence([{ hreflang: 'en', href: 'https://example.com/en/page' }]),
          {
            id: 'ev-sitemap-empty',
            kind: 'sitemap',
            source: SITEMAP_HREFLANG_SOURCE,
            capturedAt: FIXED_TIME,
            value: { loc: PAGE_URL, alternates: [] },
          },
        ]),
      ),
    ).not.toContain('hreflang-html-sitemap-mismatch');
  });
});
