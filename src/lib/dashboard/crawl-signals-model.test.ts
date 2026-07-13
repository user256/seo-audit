import { describe, expect, it } from 'vitest';
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
});
