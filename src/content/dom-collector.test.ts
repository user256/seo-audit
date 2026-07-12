import { beforeEach, describe, expect, it } from 'vitest';
import { PageSnapshotSchema } from '../lib/schemas/audit';
import { collectDomFactsInPage } from './dom-collector';
import { domFactsToPageSnapshot } from './dom-facts-to-snapshot';
import {
  FIXTURE_DUPLICATE_CANONICAL,
  FIXTURE_MALFORMED_JSON_LD,
  FIXTURE_MULTIPLE_ROBOTS,
  FIXTURE_NO_HEAD,
  FIXTURE_RELATIVE_URLS,
} from './fixtures';

function loadFixture(html: string, url: string): void {
  document.open();
  document.write(html);
  document.close();
  // jsdom may not update document.URL from write; set via history when possible.
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

  it('produces a PageSnapshot that validates against the 102 schema', () => {
    loadFixture(FIXTURE_RELATIVE_URLS, 'https://example.com/shop/item');
    const facts = collectDomFactsInPage();
    const snapshot = domFactsToPageSnapshot(facts, 'snap-1');
    expect(() => PageSnapshotSchema.parse(snapshot)).not.toThrow();
    expect(snapshot.evidence.length).toBeGreaterThan(5);
  });
});
