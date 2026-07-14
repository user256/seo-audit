import { describe, expect, it } from 'vitest';
import { SITEMAP_HREFLANG_SOURCE } from '../hreflang/rules';
import { INDEXABILITY_SOURCES } from '../rules/indexability-evidence';
import {
  robotsEvaluationFromEvidence,
  sitemapMembershipFromEvidence,
} from '../rules/indexability-evidence';
import type { RobotsFetchSuccess } from '../robots/fetch-robots';
import type { SitemapFetchSuccess } from '../sitemap/fetch-sitemap';
import type { SitemapUrlEntry } from '../sitemap/parse-xml';
import {
  buildCrawlNetworkEvidence,
  robotsEvaluationEvidenceFromFetch,
  robotsSummaryEvidence,
  sitemapHreflangEvidenceFromFetch,
  sitemapMembershipEvidenceFromFetch,
} from './build-crawl-evidence';

const PAGE = 'https://example.com/products/widget';
const FIXED = '2026-07-14T10:00:00.000Z';

function robotsSuccess(disallowAll = false): RobotsFetchSuccess {
  return {
    ok: true,
    source: 'extension-fetch',
    origin: 'https://example.com',
    requestedUrl: 'https://example.com/robots.txt',
    finalUrl: 'https://example.com/robots.txt',
    status: 200,
    fetchedAt: FIXED,
    redirectHops: [],
    truncated: false,
    bodyText: disallowAll
      ? 'User-agent: *\nDisallow: /\nSitemap: https://example.com/sitemap.xml\n'
      : 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n',
    parsed: {
      ok: true,
      groups: [
        {
          userAgents: ['*'],
          rules: disallowAll
            ? [{ kind: 'disallow', pattern: '/', lineNumber: 2 }]
            : [{ kind: 'allow', pattern: '/', lineNumber: 2 }],
        },
      ],
      sitemaps: ['https://example.com/sitemap.xml'],
      diagnostics: [],
      truncated: false,
    },
  };
}

function sitemapSuccess(listed: boolean, withHreflang = false): SitemapFetchSuccess {
  const entries = new Map<string, SitemapUrlEntry>();
  if (listed) {
    entries.set(PAGE, {
      loc: PAGE,
      locRaw: PAGE,
      alternates: withHreflang
        ? [
            {
              hreflang: 'en',
              href: PAGE,
              rawAttributes: { rel: 'alternate', hreflang: 'en', href: PAGE },
            },
            {
              hreflang: 'fr',
              href: 'https://example.com/fr/products/widget',
              rawAttributes: {
                rel: 'alternate',
                hreflang: 'fr',
                href: 'https://example.com/fr/products/widget',
              },
            },
          ]
        : [],
    });
  }
  return {
    ok: true,
    source: 'extension-fetch',
    rootUrls: ['https://example.com/sitemap.xml'],
    fetchedFiles: [
      {
        url: 'https://example.com/sitemap.xml',
        requestedUrl: 'https://example.com/sitemap.xml',
        finalUrl: 'https://example.com/sitemap.xml',
        status: 200,
        kind: 'urlset',
        fetchedAt: FIXED,
        redirectHops: [],
        childSitemaps: [],
        entryCount: entries.size,
        parseDiagnostics: [],
      },
    ],
    entries,
    truncated: false,
    visitedUrls: ['https://example.com/sitemap.xml'],
    errors: [],
  };
}

describe('buildCrawlNetworkEvidence', () => {
  it('writes robots summary + evaluation evidence that indexability parsers accept', () => {
    const robots = robotsSuccess(true);
    const evaluation = robotsEvaluationEvidenceFromFetch(robots, PAGE, FIXED);
    expect(evaluation).not.toBeNull();
    const parsed = robotsEvaluationFromEvidence(evaluation!);
    expect(parsed?.path).toBe('/products/widget');
    expect(parsed?.profiles.Googlebot?.crawlable).toBe(false);

    const summary = robotsSummaryEvidence(robots, FIXED);
    expect(summary.source).toBe(INDEXABILITY_SOURCES.ROBOTS_TXT);
    expect((summary.value as { sitemaps: string[] }).sitemaps).toEqual([
      'https://example.com/sitemap.xml',
    ]);
  });

  it('writes sitemap membership + hreflang when the audited URL is listed', () => {
    const sitemap = sitemapSuccess(true, true);
    const membershipEv = sitemapMembershipEvidenceFromFetch(sitemap, PAGE, FIXED);
    const membership = sitemapMembershipFromEvidence(membershipEv);
    expect(membership?.present).toBe(true);
    expect(membership?.matchedLoc).toBe(PAGE);

    const hreflang = sitemapHreflangEvidenceFromFetch(sitemap, PAGE, FIXED);
    expect(hreflang?.source).toBe(SITEMAP_HREFLANG_SOURCE);
    expect((hreflang?.value as { alternates: unknown[] }).alternates).toHaveLength(2);
  });

  it('omits hreflang evidence when the URL is listed without xhtml:link', () => {
    expect(sitemapHreflangEvidenceFromFetch(sitemapSuccess(true, false), PAGE, FIXED)).toBeNull();
  });

  it('bundles robots + sitemap into a single evidence list for Start audit', () => {
    const evidence = buildCrawlNetworkEvidence({
      auditedUrl: PAGE,
      robots: robotsSuccess(false),
      sitemap: sitemapSuccess(true, true),
      capturedAt: FIXED,
    });
    const sources = evidence.map((item) => item.source);
    expect(sources).toContain(INDEXABILITY_SOURCES.ROBOTS_TXT);
    expect(sources).toContain(INDEXABILITY_SOURCES.ROBOTS_EVALUATION);
    expect(sources).toContain(INDEXABILITY_SOURCES.SITEMAP_MEMBERSHIP);
    expect(sources).toContain(SITEMAP_HREFLANG_SOURCE);
  });
});
