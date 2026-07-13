import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SafeFetchOk } from '../network/types';
import {
  clearRobotsSessionCache,
  fetchRobotsForOrigin,
  getCachedRobotsForOrigin,
  processRobotsFetch,
} from './fetch-robots';
import { evaluateRobotsForUrl } from './evaluate-robots';

function headerInit(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

function okFetch(partial: Partial<SafeFetchOk> & { bodyText?: string }): SafeFetchOk {
  return {
    ok: true,
    source: 'extension-fetch',
    requestId: 'sf-test',
    method: 'GET',
    requestedUrl: 'https://example.com/robots.txt',
    finalUrl: 'https://example.com/robots.txt',
    status: 200,
    redirectHops: [],
    headers: { 'content-type': 'text/plain; charset=utf-8' },
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

describe('processRobotsFetch', () => {
  it('parses a successful plain-text robots response', () => {
    const result = processRobotsFetch(
      'https://example.com',
      'https://example.com/robots.txt',
      '2026-07-13T12:00:00.000Z',
      okFetch({
        bodyText: `
          User-agent: *
          Disallow: /secret/
          Sitemap: https://example.com/sitemap.xml
        `,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.sitemaps).toEqual(['https://example.com/sitemap.xml']);
    expect(result.parsed.groups[0]?.rules[0]).toMatchObject({
      kind: 'disallow',
      pattern: '/secret/',
    });
  });

  it('accepts missing content-type when the body is not HTML', () => {
    const result = processRobotsFetch(
      'https://example.com',
      'https://example.com/robots.txt',
      '2026-07-13T12:00:00.000Z',
      okFetch({
        headers: {},
        bodyText: 'User-agent: *\nDisallow:\n',
      }),
    );

    expect(result.ok).toBe(true);
  });

  it('maps non-200 responses to capture-style errors', () => {
    const result = processRobotsFetch(
      'https://example.com',
      'https://example.com/robots.txt',
      '2026-07-13T12:00:00.000Z',
      okFetch({ status: 404, bodyText: 'Not found' }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('robots-fetch-non-200');
    expect(result.error.status).toBe(404);
  });

  it('rejects HTML responses even when status is 200', () => {
    const result = processRobotsFetch(
      'https://example.com',
      'https://example.com/robots.txt',
      '2026-07-13T12:00:00.000Z',
      okFetch({
        headers: { 'content-type': 'text/html; charset=utf-8' },
        bodyText: '<!DOCTYPE html><html><body>Not robots</body></html>',
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('robots-fetch-html');
  });

  it('rejects truncated / oversized bodies', () => {
    const result = processRobotsFetch(
      'https://example.com',
      'https://example.com/robots.txt',
      '2026-07-13T12:00:00.000Z',
      okFetch({
        truncated: true,
        bodyText: 'User-agent: *\nDisallow: /',
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('robots-fetch-oversized');
  });

  it('maps safeFetch failures without inventing parsed robots', () => {
    const result = processRobotsFetch(
      'https://example.com',
      'https://example.com/robots.txt',
      '2026-07-13T12:00:00.000Z',
      {
        ok: false,
        source: 'extension-fetch',
        requestId: 'sf-test',
        method: 'GET',
        requestedUrl: 'https://example.com/robots.txt',
        redirectHops: [],
        timing: {
          startedAt: '2026-07-13T12:00:00.000Z',
          endedAt: '2026-07-13T12:00:01.000Z',
          durationMs: 1000,
        },
        code: 'timeout',
        message: 'Fetch timed out after 15000ms.',
        truncated: false,
        limitations: [],
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('robots-fetch-failed');
    expect(result.parseResult).toBeUndefined();
  });
});

describe('fetchRobotsForOrigin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearRobotsSessionCache();
  });

  it('fetches via safeFetch and caches per origin for the session', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          `User-agent: Googlebot\nDisallow: /private/\nSitemap: https://example.com/sitemap.xml\n`,
          {
            status: 200,
            headers: headerInit({ 'content-type': 'text/plain' }),
          },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchRobotsForOrigin('https://example.com');
    const second = await fetchRobotsForOrigin('https://example.com');

    expect(first.ok).toBe(true);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCachedRobotsForOrigin('https://example.com')?.ok).toBe(true);
  });

  it('records redirect hops from safeFetch on success', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        return new Response(null, {
          status: 301,
          headers: headerInit({ location: 'https://www.example.com/robots.txt' }),
        });
      }
      return new Response('User-agent: *\nDisallow:\n', {
        status: 200,
        headers: headerInit({ 'content-type': 'text/plain' }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchRobotsForOrigin('https://example.com', { bypassCache: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.redirectHops).toEqual([
      {
        fromUrl: 'https://example.com/robots.txt',
        toUrl: 'https://www.example.com/robots.txt',
        status: 301,
      },
    ]);
    expect(result.finalUrl).toBe('https://www.example.com/robots.txt');
  });

  it('surfaces unavailable evaluation when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('missing', { status: 404, headers: headerInit({}) });
      }),
    );

    const fetched = await fetchRobotsForOrigin('https://example.com', { bypassCache: true });
    expect(fetched.ok).toBe(false);

    const evaluation = evaluateRobotsForUrl(
      fetched.ok ? fetched.parsed : null,
      'https://example.com/page',
      fetched.ok ? undefined : { code: fetched.error.code, message: fetched.error.message },
    );
    expect(evaluation.ok).toBe(false);
    if (evaluation.ok) return;
    expect(evaluation.code).toBe('robots-fetch-non-200');
  });
});
