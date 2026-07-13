import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SafeFetchOk } from '../network/types';
import { SITEMAP_LIMITS } from './limits';
import {
  fetchSitemap,
  processSitemapFetch,
  sitemapContainsAuditedUrl,
  sitemapUrlVariants,
} from './fetch-sitemap';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

function okFetch(partial: Partial<SafeFetchOk> & { bodyText?: string }): SafeFetchOk {
  return {
    ok: true,
    source: 'extension-fetch',
    requestId: 'sf-test',
    method: 'GET',
    requestedUrl: partial.requestedUrl ?? 'https://example.com/sitemap.xml',
    finalUrl: partial.finalUrl ?? partial.requestedUrl ?? 'https://example.com/sitemap.xml',
    status: 200,
    redirectHops: [],
    headers: { 'content-type': 'application/xml' },
    timing: {
      startedAt: '2026-07-13T12:00:00.000Z',
      endedAt: '2026-07-13T12:00:01.000Z',
      durationMs: 1000,
    },
    truncated: false,
    bodyByteLength: partial.bodyText?.length ?? 0,
    mimeMatched: null,
    limitations: [],
    ...partial,
    bodyText: partial.bodyText,
  };
}

vi.mock('../network/safe-fetch', () => ({
  safeFetch: vi.fn(),
}));

import { safeFetch } from '../network/safe-fetch';

const mockedSafeFetch = vi.mocked(safeFetch);

afterEach(() => {
  vi.clearAllMocks();
});

describe('processSitemapFetch', () => {
  it('parses a successful urlset response', () => {
    const { file, parsed } = processSitemapFetch(
      'https://example.com/sitemap.xml',
      '2026-07-13T12:00:00.000Z',
      okFetch({ bodyText: fixture('urlset-basic.xml') }),
    );

    expect(file.error).toBeUndefined();
    expect(file.kind).toBe('urlset');
    expect(file.entryCount).toBe(2);
    expect(parsed?.ok).toBe(true);
  });

  it('maps non-200 responses to capture errors', () => {
    const { file } = processSitemapFetch(
      'https://example.com/sitemap.xml',
      '2026-07-13T12:00:00.000Z',
      okFetch({ status: 404, bodyText: 'missing' }),
    );

    expect(file.error?.code).toBe('sitemap-fetch-non-200');
  });

  it('rejects truncated / oversized bodies', () => {
    const { file } = processSitemapFetch(
      'https://example.com/sitemap.xml',
      '2026-07-13T12:00:00.000Z',
      okFetch({ truncated: true, bodyText: fixture('urlset-basic.xml') }),
    );

    expect(file.error?.code).toBe('sitemap-fetch-oversized');
  });
});

describe('sitemapContainsAuditedUrl', () => {
  it('matches exact loc and trailing-slash variants', () => {
    const { parsed } = processSitemapFetch(
      'https://example.com/sitemap.xml',
      '2026-07-13T12:00:00.000Z',
      okFetch({ bodyText: fixture('urlset-basic.xml') }),
    );
    if (!parsed?.ok) throw new Error('expected parse success');

    const withSlash = sitemapContainsAuditedUrl(parsed.entries, 'https://example.com/page-a/');
    expect(withSlash.present).toBe(true);
    expect(withSlash.matchedLoc).toBe('https://example.com/page-a');

    const missing = sitemapContainsAuditedUrl(parsed.entries, 'https://example.com/nope');
    expect(missing.present).toBe(false);
  });

  it('exposes URL variants for comparison', () => {
    expect(sitemapUrlVariants('https://example.com/page')).toEqual([
      'https://example.com/page',
      'https://example.com/page/',
    ]);
  });
});

describe('fetchSitemap', () => {
  it('recursively fetches child sitemaps from an index', async () => {
    mockedSafeFetch.mockImplementation(async ({ url }) => {
      if (url === 'https://example.com/sitemap_index.xml') {
        return okFetch({
          requestedUrl: url,
          finalUrl: url,
          bodyText: fixture('sitemap-index.xml'),
        });
      }
      if (url === 'https://example.com/sitemap-pages.xml') {
        return okFetch({
          requestedUrl: url,
          finalUrl: url,
          bodyText: fixture('urlset-basic.xml'),
        });
      }
      if (url === 'https://cdn.example.com/sitemap-images.xml') {
        return okFetch({
          requestedUrl: url,
          finalUrl: url,
          bodyText: `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://cdn.example.com/img.jpg</loc></url></urlset>`,
        });
      }
      return okFetch({ requestedUrl: url, finalUrl: url, status: 404, bodyText: '' });
    });

    const result = await fetchSitemap(['https://example.com/sitemap_index.xml']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.fetchedFiles).toHaveLength(3);
    expect(result.entries.size).toBe(3);
    expect(result.visitedUrls).toContain('https://cdn.example.com/sitemap-images.xml');
    expect(mockedSafeFetch).toHaveBeenCalledTimes(3);
  });

  it('sets truncated when the file cap is reached', async () => {
    let call = 0;
    mockedSafeFetch.mockImplementation(async ({ url }) => {
      call += 1;
      if (call === 1) {
        const children = Array.from(
          { length: SITEMAP_LIMITS.maxFiles + 2 },
          (_, i) => `<sitemap><loc>https://example.com/child-${i}.xml</loc></sitemap>`,
        ).join('');
        return okFetch({
          requestedUrl: url,
          finalUrl: url,
          bodyText: `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${children}</sitemapindex>`,
        });
      }
      return okFetch({
        requestedUrl: url,
        finalUrl: url,
        bodyText: `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url}</loc></url></urlset>`,
      });
    });

    const result = await fetchSitemap(['https://example.com/sitemap_index.xml']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.truncated).toBe(true);
    expect(result.fetchedFiles.length).toBeLessThanOrEqual(SITEMAP_LIMITS.maxFiles + 1);
    expect(result.errors.some((e) => e.code === 'sitemap-file-limit')).toBe(true);
  });

  it('does not revisit already-fetched sitemap URLs', async () => {
    mockedSafeFetch.mockImplementation(async ({ url }) =>
      okFetch({
        requestedUrl: url,
        finalUrl: url,
        bodyText: fixture('urlset-basic.xml'),
      }),
    );

    await fetchSitemap(['https://example.com/sitemap.xml', 'https://example.com/sitemap.xml']);

    expect(mockedSafeFetch).toHaveBeenCalledTimes(1);
  });

  it('reports membership for the audited URL in fetched entries', async () => {
    mockedSafeFetch.mockImplementation(async ({ url }) =>
      okFetch({
        requestedUrl: url,
        finalUrl: url,
        bodyText: fixture('urlset-basic.xml'),
      }),
    );

    const result = await fetchSitemap(['https://example.com/sitemap.xml']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const membership = sitemapContainsAuditedUrl(result.entries, 'https://example.com/page-b');
    expect(membership.present).toBe(true);
    expect(membership.entry?.lastmod).toBe('2026-07-02');
  });

  it('fails when all root URLs are invalid', async () => {
    const result = await fetchSitemap(['not-valid', 'ftp://bad.example/sitemap.xml']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sitemap-invalid-url');
  });
});
