import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DomFacts } from '../content/dom-collector';
import {
  buildGlanceDashboard,
  buildPreAccessDashboard,
  formatImagesForClipboard,
  formatLinksForClipboard,
} from '../lib/dashboard/model';
import { renderSeoDashboard } from './dashboard-view';

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

describe('renderSeoDashboard', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renders the pre-access dashboard with honest unavailable network slots', () => {
    const host = document.createElement('section');
    document.body.append(host);
    const model = buildPreAccessDashboard('https://example.com/start');
    renderSeoDashboard(host, model);

    expect(host.querySelector('#dashboard-heading')?.textContent).toBe('Page glance');
    expect(host.textContent).toContain(
      'Allow this site to load status, redirects, and page inventory.',
    );
    expect(host.textContent).toContain('Needs site access');
    expect(host.textContent).toContain('HTTP status requires site access');
    expect(host.textContent).toContain('Redirect journey from the requested URL needs site access');
    expect(host.querySelectorAll('dd.is-warn').length).toBeGreaterThanOrEqual(2);
    expect(host.querySelector('button')).toBeNull();
  });

  it('renders a populated glance dashboard with inventory facts and distinct unavailable states', () => {
    const host = document.createElement('section');
    document.body.append(host);
    const model = buildGlanceDashboard({
      tabUrl: 'https://example.com/page',
      facts: sampleFacts(),
    });
    renderSeoDashboard(host, model);

    expect(host.textContent).toContain('Inventory from the live tab');
    expect(host.textContent).toContain('Hello');
    expect(host.textContent).toContain('Desc');
    expect(host.textContent).toContain('H1: 1');
    expect(host.textContent).toContain('Links: 2 (internal 1, external 1, other 0)');
    expect(host.textContent).toContain('Images: 2 (alt present 1, empty 0, missing 1)');
    expect(host.textContent).toContain('HTML5 landmarks');
    expect(host.textContent).toContain('Not captured yet');
    expect(host.textContent).toContain('Response status/headers are not captured yet');
    expect(host.querySelectorAll('dd.is-warn').length).toBeGreaterThanOrEqual(1);
  });

  it('exercises both clipboard controls with stubbed clipboard payloads and accessible names', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });

    const host = document.createElement('section');
    document.body.append(host);
    const model = buildGlanceDashboard({
      tabUrl: 'https://example.com/page',
      facts: sampleFacts(),
    });
    renderSeoDashboard(host, model);

    const buttons = [...host.querySelectorAll('button')];
    expect(buttons).toHaveLength(2);
    const copyLinks = buttons[0]!;
    const copyImages = buttons[1]!;
    expect(copyLinks.textContent).toBe('Copy links (CSV)');
    expect(copyImages.textContent).toBe('Copy images (CSV)');
    expect(copyLinks.getAttribute('type')).toBe('button');
    expect(copyImages.getAttribute('type')).toBe('button');

    copyLinks.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(
      formatLinksForClipboard(model.links!, model.documentUrl!),
    );

    copyImages.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(
      formatImagesForClipboard(model.images!, model.documentUrl!),
    );
  });
});
