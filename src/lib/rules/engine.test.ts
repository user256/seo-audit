import { describe, expect, it } from 'vitest';
import { collectDomFactsInPage } from '../../content/dom-collector';
import { domFactsToPageSnapshot } from '../../content/dom-facts-to-snapshot';
import {
  FIXTURE_DUPLICATE_CANONICAL,
  FIXTURE_MALFORMED_JSON_LD,
  FIXTURE_MULTIPLE_ROBOTS,
  FIXTURE_NO_HEAD,
  FIXTURE_RELATIVE_URLS,
} from '../../content/fixtures';
import { FindingSchema } from '../schemas/audit';
import { evaluatePageSnapshot } from './engine';
import { buildPageSummary } from './summary';

const FIXED_TIME = '2026-07-12T12:00:00.000Z';

function loadFixture(html: string, url: string): void {
  document.open();
  document.write(html);
  document.close();
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

function snapshotFromFixture(html: string, url: string) {
  loadFixture(html, url);
  const facts = collectDomFactsInPage();
  facts.collectedAt = FIXED_TIME;
  return domFactsToPageSnapshot(facts, 'snap-test');
}

const CLEAN_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Clean Example Page Title</title>
    <meta name="description" content="A clean page used as a negative control." />
    <link rel="canonical" href="https://example.com/clean" />
    <meta name="viewport" content="width=device-width" />
  </head>
  <body>
    <h1>Hello</h1>
    <img src="/x.png" alt="Example diagram" />
  </body>
</html>`;

const OFF_PAGE_CANONICAL = `<!doctype html>
<html lang="en">
  <head>
    <title>Off-site canonical page</title>
    <meta name="description" content="Canonical points elsewhere." />
    <link rel="canonical" href="https://other.example/canonical" />
  </head>
  <body></body>
</html>`;

const CONFLICTING_SIGNALS = `<!doctype html>
<html>
  <head>
    <title>A</title>
    <title>B conflicts</title>
    <meta name="robots" content="noindex, nofollow" />
    <link rel="canonical" href="https://other.example/x" />
    <link rel="canonical" href="/also" />
  </head>
  <body>
    <img src="/a.png" />
  </body>
</html>`;

const BAD_HREFLANG = `<!doctype html>
<html lang="en">
  <head>
    <title>Bad hreflang page title</title>
    <meta name="description" content="Has a bad alternate." />
    <link rel="canonical" href="https://example.com/page" />
    <link rel="alternate" hreflang="fr" href="https://exa mple.com/bad space" />
  </head>
  <body></body>
</html>`;

describe('evaluatePageSnapshot', () => {
  it('returns no defect findings for a clean document (title-length may info)', () => {
    const snapshot = snapshotFromFixture(CLEAN_HTML, 'https://example.com/clean');
    const { findings, summary } = evaluatePageSnapshot(snapshot, {
      featureAvailability: {
        domCollector: true,
        headerCapture: 'unavailable',
        robotsFetch: 'unavailable',
      },
    });
    const defectIds = findings
      .filter((f) => f.severity === 'error' || f.severity === 'warning')
      .map((f) => f.ruleId);
    expect(defectIds).toEqual([]);
    expect(summary.indexability.status).toBe('unknown');
    expect(summary.indexability.status).not.toBe('indexable' as typeof summary.indexability.status);
    expect(summary.captureNotes.some((n) => /headers/i.test(n))).toBe(true);
  });

  it('triggers duplicate canonical', () => {
    const snapshot = snapshotFromFixture(FIXTURE_DUPLICATE_CANONICAL, 'https://example.com/page');
    const { findings } = evaluatePageSnapshot(snapshot);
    expect(findings.some((f) => f.ruleId === 'canonical-multiple')).toBe(true);
  });

  it('triggers robots noindex/nofollow from multiple meta robots', () => {
    const snapshot = snapshotFromFixture(FIXTURE_MULTIPLE_ROBOTS, 'https://example.com/page');
    const { findings } = evaluatePageSnapshot(snapshot);
    expect(findings.some((f) => f.ruleId === 'robots-noindex')).toBe(true);
  });

  it('triggers malformed JSON-LD', () => {
    const snapshot = snapshotFromFixture(FIXTURE_MALFORMED_JSON_LD, 'https://example.com/page');
    const { findings } = evaluatePageSnapshot(snapshot);
    expect(findings.some((f) => f.ruleId === 'jsonld-malformed')).toBe(true);
  });

  it('triggers missing language and images without alt on no-head pages', () => {
    const snapshot = snapshotFromFixture(FIXTURE_NO_HEAD, 'https://example.com/bare');
    const { findings } = evaluatePageSnapshot(snapshot);
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain('title-missing');
    expect(ids).toContain('language-missing');
    expect(ids).toContain('images-missing-alt');
    expect(ids).toContain('images-empty-alt-advisory');
  });

  it('triggers off-page canonical', () => {
    const snapshot = snapshotFromFixture(OFF_PAGE_CANONICAL, 'https://example.com/page');
    const { findings } = evaluatePageSnapshot(snapshot);
    expect(findings.some((f) => f.ruleId === 'canonical-off-page')).toBe(true);
  });

  it('covers conflicting signals deterministically', () => {
    const snapshot = snapshotFromFixture(CONFLICTING_SIGNALS, 'https://example.com/page');
    const first = evaluatePageSnapshot(snapshot);
    const second = evaluatePageSnapshot(snapshot);
    expect(first.findings.map((f) => f.id)).toEqual(second.findings.map((f) => f.id));
    const ids = first.findings.map((f) => f.ruleId);
    // At least two conflicting signal families: robots + canonical multiplicity
    expect(ids).toEqual(expect.arrayContaining(['canonical-multiple', 'robots-noindex']));
    expect(ids).toEqual(expect.arrayContaining(['robots-nofollow']));
    expect(
      ids.filter((id) => id.startsWith('robots-') || id.startsWith('canonical-')).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('flags duplicate title from synthetic evidence', () => {
    const snapshot = snapshotFromFixture(CLEAN_HTML, 'https://example.com/clean');
    const titleEv = snapshot.evidence.find((e) => e.source === 'title');
    expect(titleEv).toBeTruthy();
    titleEv!.value = {
      state: 'duplicate',
      values: ['A', 'B'],
      selectors: ['title:nth-of-type(1)', 'title:nth-of-type(2)'],
      count: 2,
    };
    const { findings } = evaluatePageSnapshot(snapshot);
    expect(findings.some((f) => f.ruleId === 'title-duplicate')).toBe(true);
  });

  it('triggers invalid hreflang URL', () => {
    const snapshot = snapshotFromFixture(BAD_HREFLANG, 'https://example.com/page');
    const { findings } = evaluatePageSnapshot(snapshot);
    expect(findings.some((f) => f.ruleId === 'hreflang-invalid-url')).toBe(true);
  });

  it('emits schema-valid findings with source refs', () => {
    const snapshot = snapshotFromFixture(FIXTURE_RELATIVE_URLS, 'https://example.com/shop/item');
    const { findings } = evaluatePageSnapshot(snapshot);
    for (const finding of findings) {
      expect(() => FindingSchema.parse(finding)).not.toThrow();
      expect(finding.sourceRef.startsWith('http')).toBe(true);
      expect(finding.evidenceIds.length).toBeGreaterThan(0);
    }
  });
});

describe('buildPageSummary', () => {
  it('never reports indexable without header and robots captures', () => {
    const summary = buildPageSummary({
      findings: [],
      featureAvailability: {
        headerCapture: 'unavailable',
        robotsFetch: 'unavailable',
      },
    });
    expect(summary.indexability.status).toBe('unknown');
    expect(JSON.stringify(summary)).not.toMatch(/"indexable"/);
  });
});
