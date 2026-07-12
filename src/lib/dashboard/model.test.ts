import { describe, expect, it } from 'vitest';
import type { DomFacts } from '../../content/dom-collector';
import {
  buildGlanceDashboard,
  buildPreAccessDashboard,
  formatImagesForClipboard,
  formatLinksForClipboard,
} from './model';

const present = (value: unknown): DomFacts['title'] => ({
  state: 'present',
  value,
  selector: 'x',
  count: 1,
});

function sampleFacts(): DomFacts {
  return {
    documentUrl: 'https://example.com/page',
    baseUri: 'https://example.com/',
    collectedAt: '2026-07-12T12:00:00.000Z',
    title: present('Hello'),
    metaDescription: present('Desc'),
    metaRobots: present({ name: 'robots', content: 'index,follow', selector: 'x' }),
    canonical: present({ href: '/page', absolute: 'https://example.com/page' }),
    alternates: { state: 'absent' },
    openGraph: { state: 'absent' },
    twitter: { state: 'absent' },
    language: present('en'),
    viewport: present('width=device-width'),
    headings: present({
      levels: { h1: 1, h2: 2, h3: 0, h4: 0, h5: 0, h6: 0 },
      samples: [{ level: 'h1', text: 'Hello' }],
    }),
    links: present({
      total: 2,
      internal: 1,
      external: 1,
      other: 0,
      inventory: [
        { href: '/a', absolute: 'https://example.com/a', text: 'A' },
        { href: 'https://other.test', absolute: 'https://other.test/', text: 'B' },
      ],
    }),
    images: present({
      total: 2,
      withAlt: 1,
      emptyAlt: 0,
      missingAlt: 1,
      inventory: [
        { src: '/a.png', alt: null, altState: 'missing' },
        { src: '/b.png', alt: 'Logo', altState: 'present' },
      ],
    }),
    html5: present({
      doctype: '<!DOCTYPE html>',
      counts: { main: 1, nav: 1, header: 1, footer: 1, article: 0, section: 0, aside: 0 },
      hasMain: true,
      landmarkTotal: 4,
    }),
    jsonLd: { state: 'absent' },
  };
}

describe('SEO dashboard model', () => {
  it('builds a pre-access dashboard that does not invent status or redirects', () => {
    const model = buildPreAccessDashboard('https://example.com/start');
    expect(model.accessGranted).toBe(false);
    expect(model.status.availability).toBe('needs-access');
    expect(model.journey.hops).toEqual([]);
    expect(model.inventoryLoaded).toBe(false);
  });

  it('builds a glance dashboard from DOM facts with honest network slots', () => {
    const model = buildGlanceDashboard({
      tabUrl: 'https://example.com/page',
      facts: sampleFacts(),
    });
    expect(model.title).toBe('Hello');
    expect(model.description).toBe('Desc');
    expect(model.status.availability).toBe('unavailable');
    expect(model.indexability.rows.some((r) => r.label === 'Canonical')).toBe(true);
    expect(model.links?.total).toBe(2);
    expect(model.html5?.hasMain).toBe(true);
  });

  it('formats clipboard payloads for links and images', () => {
    const model = buildGlanceDashboard({
      tabUrl: 'https://example.com/page',
      facts: sampleFacts(),
    });
    expect(formatLinksForClipboard(model.links!)).toContain('https://example.com/a');
    expect(formatImagesForClipboard(model.images!)).toContain('(no alt attribute)');
    expect(formatImagesForClipboard(model.images!)).toContain('Logo');
  });
});
