import { beforeEach, describe, expect, it } from 'vitest';
import { PageSnapshotSchema } from '../lib/schemas/audit';
import { parseDomFacts } from '../lib/schemas/dom-evidence';
import { evaluatePageSnapshot } from '../lib/rules/engine';
import { collectDomFactsInPage, DEFAULT_DOM_COLLECT_LIMITS } from './dom-collector';
import { domFactsToPageSnapshot } from './dom-facts-to-snapshot';
import {
  FIXTURE_DUPLICATE_CANONICAL,
  FIXTURE_EMPTY_VS_ABSENT_ALT,
  FIXTURE_MALFORMED_JSON_LD,
  FIXTURE_MULTIPLE_ROBOTS,
  FIXTURE_NO_HEAD,
  FIXTURE_NON_HTTP_CANONICAL,
  FIXTURE_RELATIVE_URLS,
  FIXTURE_ROBOTS_NONE,
  FIXTURE_ROBOTS_SUBSTRING_TRAP,
  fixtureBudgetTruncatedJsonLd,
  fixtureOversizedMeta,
} from './fixtures';

function loadFixture(html: string, url: string): void {
  document.open();
  document.write(html);
  document.close();
  try {
    window.history.replaceState({}, '', new URL(url).pathname + new URL(url).search);
  } catch {
    // ignore — some fixtures rely on <base> only
  }
  Object.defineProperty(document, 'URL', {
    configurable: true,
    get: () => url,
  });
  Object.defineProperty(document, 'baseURI', {
    configurable: true,
    get: () => {
      const base = document.querySelector('base');
      const href = base?.getAttribute('href');
      if (href) {
        try {
          return new URL(href, url).toString();
        } catch {
          return url;
        }
      }
      return url;
    },
  });
}

describe('collectDomFactsInPage', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
  });

  it('flags duplicate canonical links', () => {
    loadFixture(FIXTURE_DUPLICATE_CANONICAL, 'https://example.com/page');
    const facts = collectDomFactsInPage();
    expect(facts.canonical.state).toBe('duplicate');
    if (facts.canonical.state === 'duplicate') {
      expect(facts.canonical.count).toBe(2);
    }
  });

  it('captures multiple robots directives as duplicate', () => {
    loadFixture(FIXTURE_MULTIPLE_ROBOTS, 'https://example.com/page');
    const facts = collectDomFactsInPage();
    expect(facts.metaRobots.state).toBe('duplicate');
  });

  it('records malformed JSON-LD parse status without executing scripts', () => {
    loadFixture(FIXTURE_MALFORMED_JSON_LD, 'https://example.com/page');
    const facts = collectDomFactsInPage();
    expect(facts.jsonLd.state).toBe('present');
    if (facts.jsonLd.state === 'present') {
      const entries = facts.jsonLd.value as {
        parseStatus: string;
      }[];
      expect(entries[0]?.parseStatus).toBe('invalid-json');
      expect(entries[1]?.parseStatus).toBe('ok');
    }
  });

  it('resolves relative canonical and alternate URLs against baseURI', () => {
    loadFixture(FIXTURE_RELATIVE_URLS, 'https://example.com/shop/item');
    const facts = collectDomFactsInPage();
    expect(facts.canonical.state).toBe('present');
    if (facts.canonical.state === 'present') {
      const value = facts.canonical.value as { href: string; absolute: string };
      expect(value.href).toBe('../product');
      expect(value.absolute).toBe('https://example.com/product');
    }
    expect(facts.alternates.state).toBe('present');
  });

  it('handles pages with no head and summarises image alts', () => {
    loadFixture(FIXTURE_NO_HEAD, 'https://example.com/bare');
    const facts = collectDomFactsInPage();
    expect(facts.title.state).toBe('absent');
    expect(facts.metaDescription.state).toBe('absent');
    expect(facts.images.state).toBe('present');
    if (facts.images.state === 'present') {
      expect(facts.images.value).toMatchObject({
        total: 3,
        withAlt: 1,
        emptyAlt: 1,
        missingAlt: 1,
      });
    }
  });

  it('produces a PageSnapshot that validates against the audit schema', () => {
    loadFixture(FIXTURE_RELATIVE_URLS, 'https://example.com/shop/item');
    const facts = collectDomFactsInPage();
    expect(parseDomFacts(facts).ok).toBe(true);
    const snapshot = domFactsToPageSnapshot(facts, 'snap-1');
    expect(() => PageSnapshotSchema.parse(snapshot)).not.toThrow();
    expect(snapshot.evidence.length).toBeGreaterThan(5);
    expect(snapshot.captureLimits?.applied.maxJsonLdChars).toBe(
      DEFAULT_DOM_COLLECT_LIMITS.maxJsonLdChars,
    );
  });

  it('bounds oversized meta/OG/Twitter/hreflang and records truncation reasons', () => {
    loadFixture(
      fixtureOversizedMeta({
        ogCount: 60,
        twitterCount: 55,
        alternateCount: 80,
        stringChars: 5_000,
      }),
      'https://example.com/huge',
    );
    const facts = collectDomFactsInPage({
      ...DEFAULT_DOM_COLLECT_LIMITS,
      maxStringChars: 100,
      maxMetaItems: 10,
      maxAlternateItems: 12,
    });

    expect(facts.title.state).toBe('present');
    if (facts.title.state === 'present') {
      expect(String(facts.title.value).length).toBe(100);
      expect(facts.title.limits?.truncated).toBe(true);
    }
    expect(facts.openGraph.state).toBe('present');
    if (facts.openGraph.state === 'present') {
      expect((facts.openGraph.value as unknown[]).length).toBe(10);
      expect(facts.openGraph.limits?.omittedCount).toBe(50);
    }
    expect(facts.twitter.state).toBe('present');
    if (facts.twitter.state === 'present') {
      expect((facts.twitter.value as unknown[]).length).toBe(10);
    }
    expect(facts.alternates.state).toBe('present');
    if (facts.alternates.state === 'present') {
      expect((facts.alternates.value as unknown[]).length).toBe(12);
      expect(facts.alternates.limits?.omittedCount).toBe(68);
    }

    const snapshot = domFactsToPageSnapshot(facts, 'snap-bounds');
    expect(snapshot.evidence.some((e) => e.source === 'capture.limits')).toBe(true);
  });

  it('bounds duplicate title/meta/robots/canonical values and long canonical/alternate URL strings', () => {
    const long = 'x'.repeat(400);
    const repeated = Array.from(
      { length: 5 },
      (_, i) => `
      <title>Title ${i} ${long}</title>
      <meta name="description" content="Description ${i} ${long}" />
      <meta name="robots" content="index ${i} ${long}" />
      <link rel="canonical" href="https://example.com/${long}/${i}" />
      <link rel="alternate" hreflang="en-${long}-${i}" href="https://example.com/${long}/alt/${i}" />
    `,
    ).join('');
    loadFixture(
      `<!doctype html><html><head>${repeated}</head><body></body></html>`,
      'https://example.com/huge',
    );

    const facts = collectDomFactsInPage({
      ...DEFAULT_DOM_COLLECT_LIMITS,
      maxStringChars: 30,
      maxMetaItems: 2,
      maxAlternateItems: 2,
    });

    for (const field of [facts.title, facts.metaDescription, facts.metaRobots, facts.canonical]) {
      expect(field.state).toBe('duplicate');
      if (field.state === 'duplicate') {
        expect(field.values).toHaveLength(2);
        expect(field.count).toBe(5);
        expect(field.limits?.omittedCount).toBe(3);
        expect(field.limits?.truncated).toBe(true);
      }
    }
    expect(facts.alternates.state).toBe('present');
    if (facts.alternates.state === 'present') {
      const values = facts.alternates.value as { href: string; hreflang: string }[];
      expect(values).toHaveLength(2);
      expect(values[0]?.href).toHaveLength(30);
      expect(values[0]?.hreflang).toHaveLength(30);
      expect(facts.alternates.limits?.omittedCount).toBe(3);
      expect(facts.alternates.limits?.truncated).toBe(true);
    }
    expect(parseDomFacts(facts).ok).toBe(true);
  });

  it('rejects malformed source-specific field values before they become snapshots', () => {
    loadFixture(FIXTURE_RELATIVE_URLS, 'https://example.com/shop/item');
    const facts = collectDomFactsInPage();
    facts.title = {
      state: 'present',
      value: { text: 'not a title string' },
      selector: 'title',
    };
    const titleResult = parseDomFacts(facts);
    expect(titleResult.ok).toBe(false);
    if (!titleResult.ok) expect(titleResult.issues.join(' ')).toMatch(/title\.value/);

    facts.title = collectDomFactsInPage().title;
    facts.links = {
      state: 'present',
      value: { total: 1, internal: 1, external: 0, other: 0, inventory: 'not an array' },
      selector: 'a[href]',
    };
    const linksResult = parseDomFacts(facts);
    expect(linksResult.ok).toBe(false);
    if (!linksResult.ok) expect(linksResult.issues.join(' ')).toMatch(/links\.value\.inventory/);
  });

  it('marks budget-truncated valid JSON-LD as truncated, not invalid-json', () => {
    const budget = 80;
    loadFixture(fixtureBudgetTruncatedJsonLd(budget), 'https://example.com/jsonld');
    const facts = collectDomFactsInPage({
      ...DEFAULT_DOM_COLLECT_LIMITS,
      maxJsonLdChars: budget,
    });
    expect(facts.jsonLd.state).toBe('present');
    if (facts.jsonLd.state === 'present') {
      const entries = facts.jsonLd.value as {
        parseStatus: string;
        truncated: boolean;
      }[];
      expect(entries[0]?.truncated).toBe(true);
      expect(entries[0]?.parseStatus).toBe('truncated');
    }
    const snapshot = domFactsToPageSnapshot(facts, 'snap-jsonld');
    const { findings } = evaluatePageSnapshot(snapshot);
    expect(findings.some((f) => f.ruleId === 'jsonld-malformed')).toBe(false);
    expect(findings.some((f) => f.ruleId === 'jsonld-unevaluated')).toBe(true);
  });

  it('is self-contained for executeScript (no free module bindings in body)', () => {
    const source = collectDomFactsInPage.toString();
    expect(source).not.toMatch(/DEFAULT_DOM_COLLECT_LIMITS/);
    expect(source).not.toMatch(/DEFAULT_MAX_JSON_LD_CHARS/);
  });
});

describe('Ticket 107 rule honesty', () => {
  function findingsFor(html: string, url: string) {
    loadFixture(html, url);
    const facts = collectDomFactsInPage();
    facts.collectedAt = '2026-07-12T12:00:00.000Z';
    return evaluatePageSnapshot(domFactsToPageSnapshot(facts, 'snap-rules')).findings;
  }

  it('splits missing alt (warning) from empty alt (info advisory)', () => {
    const findings = findingsFor(FIXTURE_EMPTY_VS_ABSENT_ALT, 'https://example.com/alt');
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain('images-missing-alt');
    expect(ids).toContain('images-empty-alt-advisory');
    expect(findings.find((f) => f.ruleId === 'images-missing-alt')?.severity).toBe('warning');
    expect(findings.find((f) => f.ruleId === 'images-empty-alt-advisory')?.severity).toBe('info');
  });

  it('accepts only HTTP(S) canonical and alternate targets', () => {
    const findings = findingsFor(FIXTURE_NON_HTTP_CANONICAL, 'https://example.com/non-http');
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain('canonical-non-http');
    expect(ids).toContain('hreflang-non-http');
  });

  it('treats robots none as noindex+nofollow tokens', () => {
    const findings = findingsFor(FIXTURE_ROBOTS_NONE, 'https://example.com/none');
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain('indexability-noindex-signal');
    expect(ids).toContain('robots-nofollow');
  });

  it('does not match noindex via substring inside other directives', () => {
    const findings = findingsFor(FIXTURE_ROBOTS_SUBSTRING_TRAP, 'https://example.com/trap');
    const ids = findings.map((f) => f.ruleId);
    expect(ids).not.toContain('indexability-noindex-signal');
    expect(ids).not.toContain('robots-nofollow');
  });
});
