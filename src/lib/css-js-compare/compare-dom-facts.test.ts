import { describe, expect, it } from 'vitest';
import type { DomFacts } from '../../content/dom-collector';
import type { VisibleTextFingerprint } from '../../content/visible-text-fingerprint';
import { compareDomFacts } from './compare-dom-facts';

const NOW = '2026-07-13T12:00:00.000Z';

function baseFacts(overrides: Partial<DomFacts> = {}): DomFacts {
  return {
    documentUrl: 'https://example.com/page',
    baseUri: 'https://example.com/page',
    collectedAt: NOW,
    title: { state: 'present', value: 'Widget shop', selector: 'title', count: 1 },
    metaDescription: {
      state: 'present',
      value: 'Buy widgets online',
      selector: 'meta[name="description" i]',
      count: 1,
    },
    metaRobots: { state: 'absent' },
    canonical: {
      state: 'present',
      value: { href: '/page', absolute: 'https://example.com/page' },
      selector: 'link[rel="canonical" i]',
      count: 1,
    },
    alternates: { state: 'absent' },
    openGraph: { state: 'absent' },
    twitter: { state: 'absent' },
    language: { state: 'present', value: 'en', raw: 'en', selector: 'html[lang]', count: 1 },
    viewport: { state: 'absent' },
    headings: {
      state: 'present',
      value: {
        levels: { h1: 1, h2: 2, h3: 0, h4: 0, h5: 0, h6: 0 },
        samples: [
          { level: 'h1', text: 'Widgets' },
          { level: 'h2', text: 'Reviews' },
        ],
      },
      selector: 'h1–h6',
      count: 3,
    },
    links: {
      state: 'present',
      value: { total: 10, internal: 8, external: 2, other: 0, inventory: [] },
      selector: 'a[href]',
      count: 10,
    },
    images: {
      state: 'present',
      value: { total: 0, withAlt: 0, emptyAlt: 0, missingAlt: 0, inventory: [] },
      selector: 'img',
      count: 0,
    },
    html5: {
      state: 'present',
      value: {
        doctype: '<!DOCTYPE html>',
        counts: { main: 1, nav: 1, header: 1, footer: 1, article: 0, section: 0, aside: 0 },
        hasMain: true,
        landmarkTotal: 4,
      },
      selector: 'main,nav,header,footer,article,section,aside',
      count: 4,
    },
    jsonLd: { state: 'absent' },
    ...overrides,
  } as DomFacts;
}

function fingerprint(overrides: Partial<VisibleTextFingerprint> = {}): VisibleTextFingerprint {
  return {
    charCount: 500,
    hash: 'aaaaaaaa',
    sampleText: 'Widgets for sale',
    truncated: false,
    ...overrides,
  };
}

describe('compareDomFacts', () => {
  it('reports no changes and no observations for identical captures', () => {
    const facts = baseFacts();
    const vt = fingerprint();

    const { diffs, observations } = compareDomFacts({
      requestId: 'req-1',
      baseline: facts,
      experiment: facts,
      baselineVisibleText: vt,
      experimentVisibleText: vt,
    });

    expect(diffs).toHaveLength(7);
    expect(diffs.every((d) => !d.changed)).toBe(true);
    expect(observations).toEqual([]);
  });

  it('flags a title change and produces a matching observation', () => {
    const baseline = baseFacts();
    const experiment = baseFacts({
      title: { state: 'present', value: 'Widget shop — reduced', selector: 'title', count: 1 },
    });

    const { diffs, observations } = compareDomFacts({
      requestId: 'req-2',
      baseline,
      experiment,
      baselineVisibleText: null,
      experimentVisibleText: null,
    });

    const titleDiff = diffs.find((d) => d.field === 'title');
    expect(titleDiff?.changed).toBe(true);
    expect(titleDiff?.baselineSummary).toBe('Widget shop');
    expect(titleDiff?.experimentSummary).toBe('Widget shop — reduced');

    const observation = observations.find((o) => o.kind === 'title-changed');
    expect(observation).toBeDefined();
    expect(observation?.id).toBe('css-js-diff-req-2-title');
  });

  it('flags headings and link counts changing when hidden content becomes visible', () => {
    const baseline = baseFacts();
    const experiment = baseFacts({
      headings: {
        state: 'present',
        value: {
          levels: { h1: 1, h2: 5, h3: 0, h4: 0, h5: 0, h6: 0 },
          samples: [{ level: 'h1', text: 'Widgets' }],
        },
        selector: 'h1–h6',
        count: 6,
      },
      links: {
        state: 'present',
        value: { total: 25, internal: 20, external: 5, other: 0, inventory: [] },
        selector: 'a[href]',
        count: 25,
      },
    });

    const { diffs, observations } = compareDomFacts({
      requestId: 'req-3',
      baseline,
      experiment,
      baselineVisibleText: null,
      experimentVisibleText: null,
    });

    const headingsDiff = diffs.find((d) => d.field === 'headings');
    const linksDiff = diffs.find((d) => d.field === 'links');
    expect(headingsDiff?.changed).toBe(true);
    expect(linksDiff?.changed).toBe(true);
    expect(observations.some((o) => o.kind === 'headings-changed')).toBe(true);
    expect(observations.some((o) => o.kind === 'links-changed')).toBe(true);
    expect(linksDiff?.experimentSummary).toContain('total:25');
  });

  it('flags jsonLd parse-count changes', () => {
    const baseline = baseFacts();
    const experiment = baseFacts({
      jsonLd: {
        state: 'present',
        value: [
          {
            index: 0,
            selector: 'script[type="application/ld+json" i]',
            raw: '{}',
            truncated: false,
            parseStatus: 'ok',
          },
        ],
        selector: 'script[type="application/ld+json" i]',
        count: 1,
      },
    });

    const { diffs, observations } = compareDomFacts({
      requestId: 'req-4',
      baseline,
      experiment,
      baselineVisibleText: null,
      experimentVisibleText: null,
    });

    const jsonLdDiff = diffs.find((d) => d.field === 'jsonLd');
    expect(jsonLdDiff?.baselineSummary).toBe('(absent)');
    expect(jsonLdDiff?.changed).toBe(true);
    expect(observations.some((o) => o.kind === 'jsonld-changed')).toBe(true);
  });

  it('flags visible-text fingerprint changes with a char delta detail', () => {
    const facts = baseFacts();
    const baselineVt = fingerprint({ charCount: 500, hash: 'aaaaaaaa' });
    const experimentVt = fingerprint({ charCount: 900, hash: 'bbbbbbbb' });

    const { diffs, observations } = compareDomFacts({
      requestId: 'req-5',
      baseline: facts,
      experiment: facts,
      baselineVisibleText: baselineVt,
      experimentVisibleText: experimentVt,
    });

    const visibleDiff = diffs.find((d) => d.field === 'visibleText');
    expect(visibleDiff?.changed).toBe(true);
    const observation = observations.find((o) => o.kind === 'visible-text-changed');
    expect(observation?.detail).toContain('+400 chars');
  });

  it('treats a missing visible-text capture as "(not captured)" rather than throwing', () => {
    const facts = baseFacts();

    const { diffs } = compareDomFacts({
      requestId: 'req-6',
      baseline: facts,
      experiment: facts,
      baselineVisibleText: null,
      experimentVisibleText: null,
    });

    const visibleDiff = diffs.find((d) => d.field === 'visibleText');
    expect(visibleDiff?.baselineSummary).toBe('(not captured)');
    expect(visibleDiff?.changed).toBe(false);
  });
});
