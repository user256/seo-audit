import { describe, expect, it } from 'vitest';
import { CSS_JS_COMPARISON_LIMITS } from '../css-js-compare';
import type { NavigationObservationStatus } from '../network/types';
import type { RobotsFetchResult } from '../robots/fetch-robots';
import { parseRobotsText } from '../robots/parse-robots';
import type { SitemapFetchResult } from '../sitemap/fetch-sitemap';
import {
  buildCrawlSignalsModel,
  buildSitemapCandidatesForOrigin,
  CRAWL_SIGNALS_DISPLAY_LIMITS,
} from './crawl-signals-model';

const TAB = 'https://shop.example/products/widget';
const ORIGIN = 'https://shop.example';

function observedNavigation(
  overrides: Partial<Extract<NavigationObservationStatus, { status: 'observed' }>> = {},
): NavigationObservationStatus {
  return {
    status: 'observed',
    source: 'browser-navigation',
    tabId: 1,
    requestedUrl: TAB,
    finalUrl: TAB,
    statusCode: 200,
    redirectHops: [],
    headers: { 'content-type': 'text/html; charset=utf-8' },
    observedAt: '2026-07-13T12:00:00.000Z',
    ...overrides,
  };
}

function robotsSuccess(body: string): RobotsFetchResult {
  const parsed = parseRobotsText(body);
  if (!parsed.ok) throw new Error('fixture parse failed');
  return {
    ok: true,
    source: 'extension-fetch',
    origin: ORIGIN,
    requestedUrl: `${ORIGIN}/robots.txt`,
    finalUrl: `${ORIGIN}/robots.txt`,
    status: 200,
    fetchedAt: '2026-07-13T12:01:00.000Z',
    redirectHops: [],
    truncated: false,
    bodyText: body,
    parsed,
  };
}

describe('buildCrawlSignalsModel', () => {
  it('marks navigation as needs-access before origin permission', () => {
    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: null,
      origin: ORIGIN,
      accessGranted: false,
    });
    expect(model.navigation.availability).toBe('needs-access');
    expect(model.robots.availability).toBe('needs-access');
    expect(model.sitemap.availability).toBe('needs-access');
    expect(model.navigation.xRobotsTag.state).toBe('unavailable');
  });

  it('marks navigation unavailable when observation is missing', () => {
    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      navigation: {
        status: 'unavailable',
        source: 'unavailable',
        code: 'listener-not-attached',
        message: 'Navigation listener was not attached before the load completed.',
        recovery: 'reload-and-reobserve',
      },
    });
    expect(model.navigation.availability).toBe('unavailable');
    expect(model.navigation.xRobotsTag.state).toBe('unavailable');
    expect(model.robots.availability).toBe('unavailable');
    expect(model.sitemap.membership.state).toBe('unavailable');
  });

  it('distinguishes present vs absent X-Robots-Tag on observed navigation', () => {
    const withHeader = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      navigation: observedNavigation({
        headers: { 'x-robots-tag': 'noindex' },
      }),
    });
    expect(withHeader.navigation.availability).toBe('present');
    expect(withHeader.navigation.xRobotsTag).toEqual({
      state: 'present',
      value: 'noindex',
    });

    const withoutHeader = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      navigation: observedNavigation({ headers: {} }),
    });
    expect(withoutHeader.navigation.xRobotsTag).toEqual({
      state: 'absent',
      value: '(absent)',
    });
  });

  it('truncates long redirect hop lists for display', () => {
    const hops = Array.from({ length: 20 }, (_, i) => ({
      fromUrl: `${ORIGIN}/hop-${i}`,
      toUrl: `${ORIGIN}/hop-${i + 1}`,
      status: 301,
    }));
    const model = buildCrawlSignalsModel({
      tabUrl: `${ORIGIN}/final`,
      documentUrl: `${ORIGIN}/final`,
      origin: ORIGIN,
      accessGranted: true,
      navigation: observedNavigation({
        finalUrl: `${ORIGIN}/final`,
        redirectHops: hops,
      }),
    });
    expect(model.navigation.redirectTotal).toBe(21);
    expect(model.navigation.redirectHops).toHaveLength(
      CRAWL_SIGNALS_DISPLAY_LIMITS.maxRedirectHops,
    );
    expect(model.navigation.redirectTruncated).toBe(true);
  });

  it('surfaces robots fetch errors as capture evidence, not pass/fail', () => {
    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      robots: {
        ok: false,
        source: 'extension-fetch',
        origin: ORIGIN,
        error: {
          code: 'robots-fetch-non-200',
          source: 'extension-fetch',
          message: 'robots.txt returned HTTP 404.',
          url: `${ORIGIN}/robots.txt`,
          capturedAt: '2026-07-13T12:02:00.000Z',
          status: 404,
        },
      },
    });
    expect(model.robots.availability).toBe('error');
    expect(model.robots.error?.code).toBe('robots-fetch-non-200');
    expect(model.robots.googlebot).toBeNull();
  });

  it('evaluates Googlebot and * decisions when robots.txt parses', () => {
    const robots = robotsSuccess(`
      User-agent: Googlebot
      Disallow: /private/

      User-agent: *
      Allow: /products/
    `);
    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      robots,
    });
    expect(model.robots.availability).toBe('present');
    expect(model.robots.googlebot?.crawlable).toBe(true);
    expect(model.robots.googlebot?.reason).toBe('no-matching-rules');
    expect(model.robots.wildcard?.crawlable).toBe(true);
    expect(model.robots.wildcard?.matchedRule).toContain('allow: /products/');
  });

  it('includes robots sitemap directives in sitemap candidate discovery', () => {
    const robots = robotsSuccess(`
      User-agent: *
      Disallow:

      Sitemap: https://shop.example/sitemap.xml
    `);
    const candidates = buildSitemapCandidatesForOrigin(ORIGIN, robots);
    expect(candidates.some((c) => c.url === 'https://shop.example/sitemap.xml')).toBe(true);
    expect(candidates.some((c) => c.source === 'common-path')).toBe(true);
  });

  it('marks sitemap membership absent when URL is not listed', () => {
    const sitemap: SitemapFetchResult = {
      ok: true,
      source: 'extension-fetch',
      rootUrls: [`${ORIGIN}/sitemap.xml`],
      fetchedFiles: [
        {
          url: `${ORIGIN}/sitemap.xml`,
          requestedUrl: `${ORIGIN}/sitemap.xml`,
          finalUrl: `${ORIGIN}/sitemap.xml`,
          status: 200,
          kind: 'urlset',
          fetchedAt: '2026-07-13T12:03:00.000Z',
          redirectHops: [],
          childSitemaps: [],
          entryCount: 1,
          parseDiagnostics: [],
        },
      ],
      entries: new Map([
        [
          `${ORIGIN}/other`,
          {
            loc: `${ORIGIN}/other`,
            locRaw: `${ORIGIN}/other`,
            alternates: [],
            lastmod: undefined,
            changefreq: undefined,
            priority: undefined,
          },
        ],
      ]),
      truncated: false,
      visitedUrls: [`${ORIGIN}/sitemap.xml`],
      errors: [],
    };

    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      sitemap,
      sitemapCandidates: [{ url: `${ORIGIN}/sitemap.xml`, source: 'robots' }],
    });
    expect(model.sitemap.availability).toBe('absent');
    expect(model.sitemap.membership.state).toBe('absent');
    expect(model.sitemap.membership.matchedLoc).toBeNull();
  });

  it('marks sitemap membership present when audited URL matches', () => {
    const sitemap: SitemapFetchResult = {
      ok: true,
      source: 'extension-fetch',
      rootUrls: [`${ORIGIN}/sitemap.xml`],
      fetchedFiles: [],
      entries: new Map([
        [
          TAB,
          {
            loc: TAB,
            locRaw: TAB,
            alternates: [],
            lastmod: '2026-07-01',
            changefreq: undefined,
            priority: undefined,
          },
        ],
      ]),
      truncated: false,
      visitedUrls: [`${ORIGIN}/sitemap.xml`],
      errors: [],
    };

    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      sitemap,
    });
    expect(model.sitemap.availability).toBe('present');
    expect(model.sitemap.membership.state).toBe('present');
    expect(model.sitemap.membership.lastmod).toBe('2026-07-01');
  });

  it('surfaces sitemap fetch errors separately from membership', () => {
    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      sitemap: {
        ok: false,
        source: 'extension-fetch',
        rootUrls: [`${ORIGIN}/sitemap.xml`],
        error: {
          code: 'sitemap-fetch-non-200',
          source: 'extension-fetch',
          message: 'Sitemap returned HTTP 404.',
          url: `${ORIGIN}/sitemap.xml`,
          capturedAt: '2026-07-13T12:04:00.000Z',
          status: 404,
        },
        fetchedFiles: [],
        errors: [],
      },
    });
    expect(model.sitemap.availability).toBe('error');
    expect(model.sitemap.error?.code).toBe('sitemap-fetch-non-200');
    expect(model.sitemap.membership.state).toBe('unavailable');
  });

  it('exposes hreflang cluster validation when alternates are captured', () => {
    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      hreflangAlternates: [
        { hreflang: 'en', href: TAB },
        { hreflang: 'de', href: `${ORIGIN}/de/widget` },
      ],
    });
    expect(model.hreflangCluster.availability).toBe('present');
    expect(model.hreflangCluster.declaredTotal).toBe(2);
    expect(model.hreflangCluster.detail).toMatch(/not Googlebot/i);
    expect(model.hreflangCluster.limits.maxAlternates).toBeGreaterThan(0);
  });

  it('marks CSS/JS comparison as needs-access before origin permission', () => {
    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: null,
      origin: ORIGIN,
      accessGranted: false,
    });
    expect(model.cssJsComparison.availability).toBe('needs-access');
    expect(model.cssJsComparison.runState).toBe('idle');
  });

  it('describes the CSS/JS comparison method and JS-off omission when idle', () => {
    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
    });
    expect(model.cssJsComparison.availability).toBe('present');
    expect(model.cssJsComparison.cssOffOnly).toBe(true);
    expect(model.cssJsComparison.detail).toMatch(/css-injection-disable-v1/);
    expect(model.cssJsComparison.detail).toMatch(/deliberately omitted/);
  });

  it('summarises a completed CSS/JS comparison result', () => {
    const model = buildCrawlSignalsModel({
      tabUrl: TAB,
      documentUrl: TAB,
      origin: ORIGIN,
      accessGranted: true,
      cssJsRunState: 'done',
      cssJsResult: {
        requestId: 'css-js-1',
        auditedUrl: TAB,
        origin: ORIGIN,
        methodVersion: 'css-injection-disable-v1',
        startedAt: '2026-07-13T12:00:00.000Z',
        endedAt: '2026-07-13T12:00:05.000Z',
        cancelled: false,
        limits: CSS_JS_COMPARISON_LIMITS,
        baseline: { ok: true, facts: {} as never, visibleText: null },
        experiment: { ok: true, facts: {} as never, visibleText: null },
        cssDisable: null,
        experimentTabRestored: true,
        diffs: [
          {
            field: 'title',
            label: 'Title',
            baselineSummary: 'A',
            experimentSummary: 'B',
            changed: true,
          },
          {
            field: 'canonical',
            label: 'Canonical link',
            baselineSummary: 'A',
            experimentSummary: 'A',
            changed: false,
          },
        ],
        observations: [
          {
            id: 'css-js-diff-css-js-1-title',
            kind: 'title-changed',
            summary: 'Title changed when CSS was disabled.',
            detail: 'Baseline: A · CSS-disabled: B',
          },
        ],
        limitations: ['Not crawler parity.'],
        javascriptOff: { supported: false, reason: 'Omitted.' },
      },
    });

    expect(model.cssJsComparison.runState).toBe('done');
    expect(model.cssJsComparison.detail).toContain('1 of 2 field(s) changed');
    expect(model.cssJsComparison.result?.observations).toHaveLength(1);
  });
});
